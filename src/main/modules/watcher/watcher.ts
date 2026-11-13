// 监听文件夹：新文件落盘稳定后，按 1 秒窗口合并成一批再交给 onFiles。
import chokidar from "chokidar";
import type { ImportMode } from "@shared/types";
import { createLogger } from "../../core/logger";
import { isImage } from "../../core/fsUtils";

const log = createLogger("watch");

export interface Watcher {
  watch(dir: string, mode: ImportMode): void;
  /** 停止监听某个文件夹；原来就没在监听返回 false */
  unwatch(dir: string): boolean;
  closeAll(): void;
}

export function createWatcher({
  onFiles,
}: {
  onFiles: (files: string[], mode: ImportMode) => void;
}): Watcher {
  const watchers = new Map<string, { close(): void }>();

  return {
    watch(dir, mode) {
      if (watchers.has(dir)) return;
      let buffer: string[] = [];
      let timer: ReturnType<typeof setTimeout> | null = null;

      const w = chokidar.watch(dir, {
        ignoreInitial: true,
        ignored: /(^|[\\/])\../,
        awaitWriteFinish: { stabilityThreshold: 1500, pollInterval: 200 }, // 等文件拷贝完
      });
      w.on("add", (file: string) => {
        if (!isImage(file)) return;
        buffer.push(file);
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          onFiles(buffer, mode);
          buffer = [];
        }, 1000);
      });
      w.on("error", (err: unknown) => log.error(dir, err));
      // 关闭时要一并取消等待中的批次，否则“停止监听”之后还会导入最后那一批
      watchers.set(dir, {
        close: () => {
          if (timer) clearTimeout(timer);
          buffer = [];
          void w.close();
        },
      });
    },

    unwatch(dir) {
      const entry = watchers.get(dir);
      if (!entry) return false;
      entry.close();
      watchers.delete(dir);
      return true;
    },

    closeAll() {
      for (const w of watchers.values()) w.close();
      watchers.clear();
    },
  };
}
