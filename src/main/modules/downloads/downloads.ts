// 下载服务：拖拽（ipc）和浏览器扩展（bridge）共用同一套逻辑。
// 保存位置一律由这里决定，调用方只能传链接和“当前分类”，不能传路径：
//   当前分类是图库里的某个文件夹 → 存到那里；否则用上次选的下载文件夹；还没选过就弹系统选择框
import fs from "node:fs";
import { app, type BrowserWindow, type OpenDialogOptions } from "electron";
import type { DownloadResult } from "@shared/types";
import { createLogger } from "../../core/logger";
import { showOpenDialog } from "../../core/dialogs";
import { isDirectory } from "../../core/fsUtils";
import type { Notify } from "../../core/notify";
import { readImportMode, type Settings } from "../../core/settings";
import type { ImagesRepository } from "../../db/repositories";
import { downloadImage } from "./downloader";
import { createPartials } from "./partials";

const log = createLogger("download");
const MAX_URLS = 100;

const mb = (n: number): string => `${(n / 1024 / 1024).toFixed(1)} MB`;

export interface DownloadJob {
  urls: unknown;
  pageUrl?: unknown;
  filter?: unknown;
  /** 为空（扩展触发、窗口已关）时弹无父窗口的对话框 */
  win?: BrowserWindow | null;
  /** 进度提示；quiet 为 true 时只更新界面，不弹系统通知（进度提示很频繁） */
  onStatus?: Notify;
}

export interface Downloads {
  enqueue(job: DownloadJob): Promise<DownloadResult>;
  cancelAll(): void;
  /** 弹系统选择框并保存；用户取消返回 null */
  chooseDir(win: BrowserWindow | null | undefined): Promise<string | null>;
  savedDir(): string | null;
  /** 退出时调用：中断下载并清理 .part */
  shutdown(): void;
}

export interface DownloadsDeps {
  images: Pick<ImagesRepository, "hasDir" | "hasSource">;
  importer: {
    enqueueImport(
      inputs: string[],
      options: { mode: "reference" | "copy"; silent: boolean },
    ): Promise<{ added: number; skipped: number }>;
  };
  settings: Settings;
}

const emptyResult = (canceled: boolean, dir: string | null = null): DownloadResult => ({
  canceled,
  dir,
  added: 0,
  skipped: 0,
  failed: 0,
  reason: "",
});

export function createDownloads({ images, importer, settings }: DownloadsDeps): Downloads {
  const { tracker, sweepNow } = createPartials(settings);

  // 取消：每个任务在入队时拿到当时的信号；cancelAll 会中断正在下载的，也让排队中的直接作废
  let batch = new AbortController();

  async function chooseDir(win: BrowserWindow | null | undefined): Promise<string | null> {
    const options: OpenDialogOptions = {
      title: "选择图片下载保存的文件夹",
      defaultPath: settings.get("downloadDir") || app.getPath("pictures"),
      properties: ["openDirectory", "createDirectory"],
    };
    const result = await showOpenDialog(win ?? null, options);
    if (result.canceled || !result.filePaths[0]) return null;
    settings.set("downloadDir", result.filePaths[0]);
    return result.filePaths[0];
  }

  async function resolveDir(
    win: BrowserWindow | null | undefined,
    filter: unknown,
  ): Promise<string | null> {
    if (typeof filter === "string" && filter.startsWith("folder:")) {
      const dir = filter.slice(7);
      if (images.hasDir(dir) && isDirectory(dir)) return dir;
    }
    const saved = settings.get("downloadDir");
    if (typeof saved === "string" && isDirectory(saved)) return saved;
    return chooseDir(win);
  }

  async function run(
    { urls, pageUrl, filter, win, onStatus }: DownloadJob,
    signal: AbortSignal,
  ): Promise<DownloadResult> {
    if (signal.aborted) return emptyResult(true);
    // 进度类提示都带 downloading: true，界面据此显示“取消下载”按钮
    const say = (text: string, quiet = true): void => {
      try {
        onStatus?.({ text, downloading: true }, quiet);
      } catch {
        /* 提示失败不影响下载 */
      }
    };
    const list = [
      ...new Set(
        (Array.isArray(urls) ? urls : [])
          .filter((u): u is string => typeof u === "string")
          .map((u) => u.trim())
          .filter(Boolean),
      ),
    ].slice(0, MAX_URLS);
    if (!list.length) return emptyResult(false);

    const dir = await resolveDir(win, filter);
    if (!dir) return emptyResult(true);
    say(`开始下载 ${list.length} 张，等待服务器响应…`, false);

    const referer = typeof pageUrl === "string" ? pageUrl : undefined;
    const result = emptyResult(false, dir);
    const fail = (message: string): void => {
      result.failed++;
      result.reason ||= message; // reason 只记第一个失败原因，方便界面提示
    };
    for (const [index, url] of list.entries()) {
      if (signal.aborted) break;
      const label = list.length > 1 ? `正在下载 ${index + 1}/${list.length}` : "正在下载";
      let lastSaid = 0;
      const onProgress = ({ received, total }: { received: number; total: number }): void => {
        const now = Date.now();
        if (now - lastSaid < 500) return; // 最多每 0.5 秒更新一次
        lastSaid = now;
        say(
          total
            ? `${label}：${mb(received)} / ${mb(total)}（${Math.floor((received / total) * 100)}%）`
            : `${label}：已收到 ${mb(received)}`,
        );
      };
      // 心跳：服务器迟迟不回数据时，每 3 秒刷新一次提示（界面提示 5 秒会消失），让人知道还在等，而不是卡死了
      const startedAt = Date.now();
      let downloading = true;
      const heartbeat = setInterval(() => {
        if (!downloading || Date.now() - lastSaid < 3000) return;
        say(
          `${label}：等待服务器响应… 已等 ${Math.floor((Date.now() - startedAt) / 1000)} 秒（超过 30 秒无数据会判定失败）`,
        );
      }, 3000);
      try {
        // isTaken：数据库里记过的路径（哪怕文件已被删）也不能复用，否则新文件会被当成“已导入”而清掉
        const file = await downloadImage(url, dir, {
          referer,
          isTaken: (p) => images.hasSource(p),
          onProgress,
          signal,
          tracker,
        });
        downloading = false;
        say(`${label}：下载完成，正在入库…`);
        // 沿用用户上次导入时选的入库方式（引用原路径 / 复制到图库托管）
        const state = await importer.enqueueImport([file], {
          mode: readImportMode(settings),
          silent: true,
        });
        if (state.added) {
          result.added++;
        } else if (state.skipped) {
          result.skipped++;
          // 内容重复：清掉刚下载的这份（本次下载刚创建的、路径保证原先不存在），别在目录里留垃圾
          const st = await fs.promises.lstat(file).catch(() => null);
          if (st?.isFile() && !st.isSymbolicLink()) await fs.promises.unlink(file).catch(() => {});
        } else {
          fail("导入图库失败"); // 文件留在磁盘上，不删
        }
      } catch (err) {
        if (signal.aborted) break; // 用户取消不算失败
        fail((err as Error).message);
        log.error("failed:", url, err);
      } finally {
        clearInterval(heartbeat);
      }
    }
    if (signal.aborted) result.canceled = true;
    return result;
  }

  // 下载任务排队逐个执行：避免同时弹出多个选择框，也避免两次下载抢同一个文件名
  let queue: Promise<unknown> = Promise.resolve();
  let waiting = 0;

  return {
    enqueue(job) {
      if (waiting > 0) {
        try {
          job.onStatus?.({ text: "前面还有下载任务，已排队等待…", downloading: true }, false);
        } catch {
          /* 忽略 */
        }
      }
      waiting++;
      const signal = batch.signal;
      const task = queue.then(() => run(job, signal));
      queue = task
        .catch(() => {})
        .then(() => {
          waiting--;
        });
      return task;
    },
    cancelAll() {
      batch.abort();
      batch = new AbortController();
    },
    chooseDir,
    savedDir: () => settings.get("downloadDir") ?? null,
    shutdown() {
      batch.abort(); // 中断下载；各自的清理会尽力删掉 .part
      sweepNow();
    },
  };
}
