// 下载单张图片：.part 临时文件、'wx' 写入、Referer 三种尝试、30 秒无数据超时、单张 200MB 上限。
import fs from "node:fs";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { net } from "electron";
import { createLogger } from "../../core/logger";
import { pickName, uniquePath } from "./filename";

const log = createLogger("download");
const MAX_BYTES = 200 * 1024 * 1024; // 单张上限
const TIMEOUT_MS = 30000; // 连接 / 数据停滞超过这个时间就放弃（每收到数据都会重新计时）
const OCTET_STREAM = /^(application|binary)\/octet-stream$/;

/** 登记正在写的 .part 临时文件，程序被关掉后可以据此清理（见 partials.ts） */
export interface PartialTracker {
  add(file: string): void;
  remove(file: string): void;
}

export interface DownloadOptions {
  /** 很多站点有防盗链，默认用图片所在站点的首页 */
  referer?: string;
  /** 除了磁盘上已存在的文件，还有哪些路径不能用（例如数据库里记过、但文件已被删掉的路径） */
  isTaken?: (file: string) => boolean;
  /** total 为 0 表示服务器没告诉大小 */
  onProgress?: (progress: { received: number; total: number }) => void;
  /** 外部取消信号（用户点“取消下载”）：立即中断并清掉半成品，抛出“已取消” */
  signal?: AbortSignal;
  tracker?: PartialTracker;
}

/**
 * 依次尝试三种带 Referer 的方式，前一种在网络层就失败（比如 net::ERR_BLOCKED_BY_CLIENT）才试下一种。
 * 为什么要试：没法在真实 Electron 里确认哪种方式对哪些站点有效，所以每次失败都写进控制台，方便定位。
 *   1. 标准的 fetch `referrer` 选项（实测：请求头里直接写 Referer 会被拦，所以先试它）
 *   2. 请求头里直接写 Referer
 *   3. 不带 Referer
 * HTTP 错误（403/404 等）说明请求已经发出去了，不再重试。
 */
async function fetchWithFallback(
  url: string,
  referer: string,
  signal: AbortSignal,
): Promise<Response> {
  const attempts: [string, Record<string, unknown>][] = [
    ["referrer-option", { referrer: referer }],
    ["header", { headers: { Referer: referer } }],
    ["no-referer", {}],
  ];
  let lastErr: unknown;
  for (const [name, init] of attempts) {
    try {
      return await net.fetch(url, { ...init, signal });
    } catch (err) {
      if (signal.aborted) throw err;
      log.error(`net.fetch (${name}) failed:`, url, (err as Error).message);
      lastErr = err;
    }
  }
  throw lastErr;
}

/** 下载单张图片到 dir，返回最终文件路径 */
export async function downloadImage(
  url: string,
  dir: string,
  { referer, isTaken = () => false, onProgress, signal: external, tracker }: DownloadOptions = {},
): Promise<string> {
  const u = new URL(url); // 非法链接会在这里抛错
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("只支持 http/https 链接");

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const arm = (): void => {
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  };
  let tmp: string | null = null;
  const onExternalAbort = (): void => controller.abort();
  if (external?.aborted) throw new Error("已取消");
  external?.addEventListener("abort", onExternalAbort, { once: true });
  arm();
  try {
    const res = await fetchWithFallback(url, referer || `${u.origin}/`, controller.signal);
    if (!res.ok || !res.body) throw new Error(`下载失败：HTTP ${res.status}`);
    if (Number(res.headers.get("content-length")) > MAX_BYTES) throw new Error("文件过大");

    const total = Number(res.headers.get("content-length")) || 0;
    const mime = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (mime && !mime.startsWith("image/") && !OCTET_STREAM.test(mime))
      throw new Error("返回的不是图片");
    const fileName = pickName(url, mime);
    if (!fileName) throw new Error("不支持的图片格式");

    await fs.promises.mkdir(dir, { recursive: true });
    // 先写成 .xxx.part：以点开头，监听器和扫描都会忽略；写完再改名，不会有人读到半个文件
    const part = path.join(dir, `.${Date.now()}-${Math.random().toString(36).slice(2)}.part`);
    tmp = part;
    tracker?.add(part);
    let bytes = 0;
    const limiter = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        arm();
        bytes += chunk.length;
        onProgress?.({ received: bytes, total });
        if (bytes > MAX_BYTES) return cb(new Error("文件过大"));
        cb(null, chunk);
      },
    });
    await pipeline(
      Readable.fromWeb(res.body as unknown as WebReadableStream),
      limiter,
      fs.createWriteStream(part, { flags: "wx" }), // 'wx'：绝不覆盖已有文件
    );
    if (bytes === 0) throw new Error("下载到的文件是空的");

    const dest = uniquePath(dir, fileName, (p) => fs.existsSync(p) || isTaken(p));
    await fs.promises.rename(part, dest);
    tracker?.remove(part);
    tmp = null;
    return dest;
  } catch (err) {
    if (tmp) {
      await fs.promises.unlink(tmp).catch(() => {});
      tracker?.remove(tmp);
    }
    if (external?.aborted) throw new Error("已取消");
    if (controller.signal.aborted) throw new Error("下载超时");
    throw err;
  } finally {
    external?.removeEventListener("abort", onExternalAbort);
    clearTimeout(timer);
    controller.abort(); // 提前出错时，顺便释放没读完的连接
  }
}
