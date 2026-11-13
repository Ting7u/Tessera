// 单张图片的 IPC：列表、统计、打开、定位、复制、收藏、更多菜单。
// 渲染进程只传 id，真实路径一律从数据库取，不接受渲染进程传来的路径。
import fs from "node:fs";
import { clipboard, Menu, shell } from "electron";
import { handle } from "../../core/ipc";
import { toId } from "../../core/sanitize";
import type { ImagesRepository } from "../../db/repositories";
import { createImageCopier } from "./copyImage";

const MISSING = { ok: false, error: "原文件不存在，可能已被移动或删除" } as const;

export function registerImagesIpc({ images }: { images: ImagesRepository }): void {
  const existingPath = (rawId: unknown): string | null => {
    const id = toId(rawId);
    const file = id && images.getPath(id);
    return file && fs.existsSync(file) ? file : null;
  };
  const copyImage = createImageCopier();

  // 渲染进程传来的参数不可信，images.list 内部会做类型收敛和范围限制
  handle("library:list", (_ctx, params) =>
    images.list(params && typeof params === "object" ? params : {}),
  );
  handle("library:stats", () => images.stats());
  handle("library:sidebar", () => images.sidebar());

  handle("library:open", async (_ctx, id) => {
    const file = existingPath(id);
    if (!file) return MISSING;
    const error = await shell.openPath(file); // 用系统默认看图软件打开，失败时返回错误文本
    return error ? { ok: false, error } : { ok: true };
  });

  handle("library:reveal", (_ctx, id) => {
    const file = existingPath(id);
    if (!file) return MISSING;
    shell.showItemInFolder(file);
    return { ok: true };
  });

  handle("library:copy-image", (_ctx, id) => {
    const file = existingPath(id);
    return file ? copyImage(file) : MISSING;
  });

  // 系统原生右键菜单，不需要在界面里自己写下拉
  handle("library:more-menu", ({ window }, id) => {
    const file = existingPath(id);
    if (!file) return MISSING;
    Menu.buildFromTemplate([
      { label: "在文件夹中显示", click: () => shell.showItemInFolder(file) },
      { label: "复制文件路径", click: () => clipboard.writeText(file) },
    ]).popup({ window: window ?? undefined });
    return { ok: true };
  });

  handle("library:set-favorite", (_ctx, id, value) => {
    const imageId = toId(id);
    return imageId ? images.setFavorite(imageId, !!value) : false;
  });
}
