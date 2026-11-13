// 导入相关的 IPC：只做“接收参数 → 校验 → 调服务 → 返回”。
import fs from "node:fs";
import path from "node:path";
import type { OpenDialogOptions } from "electron";
import { IMAGE_EXTS } from "@shared/constants";
import { showOpenDialog } from "../../core/dialogs";
import { handle } from "../../core/ipc";
import { readImportMode, type Settings } from "../../core/settings";
import type { WatchersRepository } from "../../db/repositories";
import type { Importer } from "./importer";

export interface ImporterIpcDeps {
  importer: Importer;
  watchers: WatchersRepository;
  /** 开始监听文件夹（由 watcher 模块提供，composition 传入） */
  watchDir: (dir: string, mode: "reference" | "copy") => void;
  settings: Settings;
}

const MAX_DROPPED_PATHS = 5000;

export function registerImporterIpc({
  importer,
  watchers,
  watchDir,
  settings,
}: ImporterIpcDeps): void {
  // 渲染进程只传选项，路径由主进程的系统对话框产生，不接受渲染进程传来的任意路径
  handle("library:import", async ({ window }, request) => {
    const { source, mode, watch } = request;
    if (source !== "files" && source !== "folder") throw new Error("invalid source");
    const safeMode = mode === "copy" ? "copy" : "reference";

    const options: OpenDialogOptions = {
      title: source === "folder" ? "选择要导入的文件夹" : "选择要导入的图片",
      properties: source === "folder" ? ["openDirectory"] : ["openFile", "multiSelections"],
      filters:
        source === "files"
          ? [{ name: "图片", extensions: IMAGE_EXTS.map((e) => e.slice(1)) }]
          : undefined,
    };
    const result = await showOpenDialog(window, options);
    if (result.canceled || !result.filePaths.length) return { canceled: true };
    settings.set("importMode", safeMode); // 记住入库方式：下次打开导入弹窗时预选，网页下载的图片也沿用它

    if (source === "folder" && watch) {
      for (const dir of result.filePaths) {
        watchers.add({ path: dir, mode: safeMode });
        watchDir(dir, safeMode);
      }
    }
    void importer.enqueueImport(result.filePaths, { mode: safeMode }); // 后台执行，不 await
    return { canceled: false };
  });

  // 拖拽导入：路径来自渲染进程，所以逐条校验：必须是字符串、绝对路径、真实存在，
  // 并且是文件夹或受支持的图片扩展名；数量也做上限
  handle("library:import-paths", async (_ctx, paths) => {
    if (!Array.isArray(paths)) return { count: 0 };
    const exts = new Set<string>(IMAGE_EXTS.map((e) => e.toLowerCase()));
    const valid: string[] = [];
    const dirs: string[] = []; // 拖进来的文件夹：导入后同时开始监听
    for (const p of paths.slice(0, MAX_DROPPED_PATHS)) {
      if (typeof p !== "string" || !path.isAbsolute(p)) continue;
      try {
        const st = await fs.promises.stat(p);
        if (st.isDirectory()) {
          valid.push(p);
          dirs.push(p);
        } else if (st.isFile() && exts.has(path.extname(p).toLowerCase())) {
          valid.push(p);
        }
      } catch {
        /* 路径不存在或无权限：跳过 */
      }
    }
    if (!valid.length) return { count: 0 };
    const mode = readImportMode(settings); // 沿用导入弹窗里上次选的入库方式
    // 和导入弹窗里默认开启的“监听导入文件夹”一致：文件夹登记监听，之后新增的图片自动入库
    for (const dir of dirs) {
      watchers.add({ path: dir, mode });
      watchDir(dir, mode);
    }
    void importer.enqueueImport(valid, { mode });
    return { count: valid.length };
  });

  handle("library:get-import-mode", () => readImportMode(settings));
}
