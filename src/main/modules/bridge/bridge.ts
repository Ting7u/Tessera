// 本机接口：只给 Tessera 的浏览器扩展用（右键网页图片 → 下载到 Tessera）。
// 端口范围见 shared/constants.ts，要和 extensions/browser/background.js 里的 PORTS 保持一致。
import crypto from "node:crypto";
import http from "node:http";
import { app, BrowserWindow, type MessageBoxOptions } from "electron";
import { BRIDGE_PORT_COUNT, BRIDGE_PORT_START } from "@shared/constants";
import type { DownloadResult } from "@shared/types";
import { showMessageBox } from "../../core/dialogs";
import { createLogger } from "../../core/logger";
import type { Notify } from "../../core/notify";
import type { Settings } from "../../core/settings";

const log = createLogger("bridge");
const PORTS = Array.from({ length: BRIDGE_PORT_COUNT }, (_, i) => BRIDGE_PORT_START + i);
const EXT_ORIGIN = /^(chrome|edge|moz)-extension:\/\/[a-z0-9-]+$/i;
const LOCAL_HOST = /^(127\.0\.0\.1|localhost)(:\d+)?$/;
const MAX_BODY = 1024 * 1024;
const DENY_COOLDOWN_MS = 60 * 1000;

/*
 * 安全设计（这个接口会监听本机端口，网页里的脚本也能向 127.0.0.1 发请求，所以必须设防）：
 *  1. 只监听 127.0.0.1，不对局域网开放。
 *  2. Host 必须是 127.0.0.1 / localhost，挡住 DNS 重绑定。
 *  3. 除 /ping 外，请求的 Origin 必须是浏览器扩展（chrome-extension:// 等）。
 *     网页脚本发请求时浏览器会带上网页自己的 Origin 且无法伪造，所以普通网页过不了这一关。
 *  4. 第一次连接要在 Tessera 里点“允许”，之后每个扩展用自己的令牌（令牌和扩展 Origin 绑定）。
 *  5. 请求体限制 1MB；下载本身仍走 downloads 的规则（只下 http/https 图片、数量和大小有上限）。
 */

export interface BridgeDeps {
  settings: Settings;
  downloads: {
    enqueue(job: {
      urls: string[];
      pageUrl?: string;
      filter: string;
      win: BrowserWindow | null;
      onStatus: Notify;
    }): Promise<DownloadResult>;
  };
  /** 界面当前所在的分类（扩展触发下载时决定“当前文件夹”） */
  ui: { activeFilter: string };
  notify: Notify;
  /** 把下载结果写成一句话 */
  describeResult: (result: DownloadResult) => string;
}

export interface Bridge {
  /** 依次尝试端口范围，返回实际监听的端口；全部被占用时返回 null（扩展功能不可用，但不影响应用本身） */
  start(): Promise<number | null>;
  stop(): void;
}

interface DownloadBody {
  urls?: unknown;
  pageUrl?: unknown;
}

export function createBridge({
  settings,
  downloads,
  ui,
  notify,
  describeResult,
}: BridgeDeps): Bridge {
  let server: http.Server | null = null;
  let pairingOrigin: string | null = null; // 正在等用户确认的扩展（同一时间只弹一个确认框）
  const denied = new Map<string, number>(); // origin → 冷却到期时间，避免被拒绝后反复弹窗

  const tokens = (): Record<string, string> => settings.get("bridgeTokens") || {};
  const getWindow = (): BrowserWindow | null => BrowserWindow.getAllWindows()[0] ?? null;

  function cors(origin: string | undefined): Record<string, string> {
    return origin && EXT_ORIGIN.test(origin)
      ? { "access-control-allow-origin": origin, vary: "Origin" }
      : {};
  }
  function send(res: http.ServerResponse, status: number, body: unknown, origin?: string): void {
    res.writeHead(status, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...cors(origin),
    });
    res.end(JSON.stringify(body));
  }
  function readJson(req: http.IncomingMessage): Promise<DownloadBody> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;
      req.on("data", (c: Buffer) => {
        size += c.length;
        if (size > MAX_BODY) {
          reject(new Error("请求体过大"));
          req.destroy();
          return;
        }
        chunks.push(c);
      });
      req.on("end", () => {
        try {
          resolve(
            chunks.length
              ? (JSON.parse(Buffer.concat(chunks).toString("utf8")) as DownloadBody)
              : {},
          );
        } catch {
          reject(new Error("JSON 格式错误"));
        }
      });
      req.on("error", reject);
    });
  }
  const safeEqual = (a: string, b: string): boolean => {
    const x = Buffer.from(String(a));
    const y = Buffer.from(String(b));
    return x.length === y.length && crypto.timingSafeEqual(x, y);
  };

  // 首次连接：弹确认框，立即返回 202，扩展轮询 /pair 等结果（避免长时间挂着一个请求）
  async function askPairing(origin: string): Promise<void> {
    pairingOrigin = origin;
    try {
      const options: MessageBoxOptions = {
        type: "question",
        buttons: ["允许", "拒绝"],
        defaultId: 1,
        cancelId: 1,
        title: "浏览器扩展请求连接",
        message: "有一个浏览器扩展想连接 Tessera",
        detail: `来源：${origin}\n\n允许后，它可以把你在网页上右键选中的图片下载到图库。\n如果这不是你刚安装的“Tessera”扩展，请选择拒绝。`,
      };
      const win = getWindow();
      const r = await showMessageBox(win, options);
      if (r.response === 0) {
        settings.set("bridgeTokens", {
          ...tokens(),
          [origin]: crypto.randomBytes(32).toString("hex"),
        });
      } else {
        denied.set(origin, Date.now() + DENY_COOLDOWN_MS);
      }
    } finally {
      pairingOrigin = null;
    }
  }

  async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const origin = req.headers.origin;
    if (!LOCAL_HOST.test(req.headers.host || "")) return send(res, 403, { error: "bad host" });

    if (req.method === "OPTIONS") {
      // 预检请求
      res.writeHead(204, {
        ...cors(origin),
        "access-control-allow-methods": "GET, POST",
        "access-control-allow-headers": "authorization, content-type",
        "access-control-max-age": "600",
      });
      return void res.end();
    }

    const { pathname } = new URL(req.url ?? "/", "http://127.0.0.1");
    if (req.method === "GET" && pathname === "/ping") {
      return send(res, 200, { app: "tessera", version: app.getVersion() }, origin);
    }

    if (!origin || !EXT_ORIGIN.test(origin))
      return send(res, 403, { error: "只接受来自浏览器扩展的请求" });

    if (req.method === "POST" && pathname === "/pair") {
      const token = tokens()[origin];
      if (token) return send(res, 200, { token }, origin);
      if ((denied.get(origin) || 0) > Date.now())
        return send(res, 403, { error: "denied" }, origin);
      if (pairingOrigin && pairingOrigin !== origin)
        return send(res, 409, { error: "busy" }, origin);
      if (!pairingOrigin) askPairing(origin).catch((err) => log.error("pairing", err)); // 不 await
      return send(res, 202, { status: "pending" }, origin);
    }

    if (req.method === "POST" && pathname === "/download") {
      const m = /^Bearer (\S+)$/.exec(req.headers.authorization || "");
      const token = tokens()[origin];
      if (!m || !token || !safeEqual(m[1], token))
        return send(res, 401, { error: "unauthorized" }, origin);

      const body = await readJson(req);
      const urls = Array.isArray(body.urls)
        ? body.urls.filter((u): u is string => typeof u === "string")
        : [];
      if (!urls.length) return send(res, 400, { error: "no urls" }, origin);
      send(res, 202, { accepted: urls.length }, origin); // 先应答，下载在后台进行，结果通过界面 / 系统通知告知
      downloads
        .enqueue({
          urls,
          pageUrl: typeof body.pageUrl === "string" ? body.pageUrl : undefined,
          filter: ui.activeFilter,
          win: getWindow(),
          onStatus: notify,
        })
        .then((result) => notify({ text: describeResult(result) }))
        .catch((err: Error) => {
          log.error("download", err);
          notify({ text: `下载出错：${err.message}` });
        });
      return;
    }

    return send(res, 404, { error: "not found" }, origin);
  }

  return {
    start() {
      return new Promise((resolve) => {
        let i = 0;
        const tryNext = (): void => {
          if (i >= PORTS.length) {
            log.error("没有可用端口");
            return resolve(null);
          }
          const port = PORTS[i++];
          const s = http.createServer((req, res) => {
            handleRequest(req, res).catch((err: Error) => {
              if (!res.headersSent) send(res, 400, { error: err.message }, req.headers.origin);
              else res.end();
            });
          });
          s.once("error", (err: NodeJS.ErrnoException) => {
            if (err.code === "EADDRINUSE") return tryNext();
            log.error(err);
            return resolve(null);
          });
          s.listen(port, "127.0.0.1", () => {
            s.removeAllListeners("error");
            s.on("error", (err) => log.error(err));
            server = s;
            resolve(port);
          });
        };
        tryNext();
      });
    },
    stop() {
      if (!server) return;
      server.closeAllConnections?.();
      server.close();
      server = null;
    },
  };
}
