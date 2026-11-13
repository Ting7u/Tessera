// 文件夹管理：只通过系统原生的右键菜单和确认框操作。
// 渲染进程只传侧边栏里的文件夹路径，并且必须是图库里确实存在的文件夹（images.hasDir），不能传任意路径。
// 安全原则：永远不删除用户的原文件；只删 Tessera 自己生成的缩略图；
// 托管副本只在用户明确勾选时才移到回收站（不直接永久删除）。
import path from "node:path";
import { Menu, shell, type BrowserWindow } from "electron";
import type { ImportMode } from "@shared/types";
import { showMessageBox } from "../../core/dialogs";
import { isDirectory, isInside, isInsideReal, isRegularFile } from "../../core/fsUtils";
import { broadcast } from "../../core/ipc";
import { createLogger } from "../../core/logger";
import { runSafely } from "../../core/menu";
import { say } from "../../core/notify";
import type { ImagesRepository, RemovedImage, WatchersRepository } from "../../db/repositories";

const log = createLogger("folders");

export interface FoldersDeps {
  images: Pick<ImagesRepository, "hasDir" | "folderInfo" | "removeFolder">;
  watchers: WatchersRepository;
  watcher: { watch(dir: string, mode: ImportMode): void; unwatch(dir: string): boolean };
  /** 图库托管目录：只有这里面的副本才允许移到回收站 */
  libraryDir: string;
  deleteThumbs: (rows: RemovedImage[]) => Promise<void>;
}

export function createFolders({
  images,
  watchers,
  watcher,
  libraryDir,
  deleteThumbs,
}: FoldersDeps): {
  /** 弹出文件夹的右键菜单；dir 不在图库里返回 false */
  popupMenu(win: BrowserWindow | null, dir: unknown): boolean;
} {
  /** 正在监听这个文件夹的监听根目录（监听是递归的，所以它自己或它的上级文件夹都算） */
  const watchRoots = (dir: string): string[] =>
    watchers
      .all()
      .map((w) => w.path)
      .filter((root) => isInside(root, dir));

  async function stopWatching(win: BrowserWindow | null, dir: string): Promise<void> {
    const roots = watchRoots(dir);
    if (!roots.length) return;
    const wider = roots.filter((root) => root !== dir);
    if (wider.length) {
      const { response } = await showMessageBox(win, {
        type: "question",
        buttons: ["停止监听", "取消"],
        defaultId: 1,
        cancelId: 1,
        noLink: true,
        title: "停止监听",
        message: `这个文件夹是通过监听“${wider[0]}”加入的`,
        detail:
          "监听是针对整个文件夹（包括它的所有子文件夹）的，停止后这些文件夹里的新图片都不会再自动加入图库。已有的图片不受影响。",
      });
      if (response !== 0) return;
    }
    for (const root of roots) {
      watchers.remove(root);
      watcher.unwatch(root);
    }
    say(`已停止监听 ${roots[0]}`);
  }

  function startWatching(dir: string): void {
    if (!isDirectory(dir)) return say("文件夹不存在，无法监听");
    // 入库方式沿用这个文件夹里已有图片的方式：有托管副本就继续复制，否则引用原路径
    const mode: ImportMode = images.folderInfo(dir).managed > 0 ? "copy" : "reference";
    watchers.add({ path: dir, mode });
    watcher.watch(dir, mode);
    say(
      `已开始监听 ${dir}，新图片会自动加入图库（入库方式：${mode === "copy" ? "复制到图库托管" : "引用原路径"}）`,
    );
  }

  async function removeFolder(win: BrowserWindow | null, dir: string): Promise<void> {
    const info = images.folderInfo(dir);
    if (!info.count) return;
    const roots = watchRoots(dir);
    let detail = `将从 Tessera 图库中移除这个文件夹里的 ${info.count} 张图片（记录和缩略图），不会删除你电脑上的原文件。`;
    if (roots.length) {
      detail += `\n\n它正在被监听（${roots[0]}）。移除时会同时停止这个监听，否则下次启动 Tessera 时这些图片会被重新导入。`;
      if (roots.some((r) => r !== dir))
        detail += "该监听范围内其他子文件夹的新图片也将不再自动加入。";
    }
    const { response, checkboxChecked } = await showMessageBox(win, {
      type: "warning",
      buttons: ["移除", "取消"],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
      title: "从图库移除",
      message: `从图库移除“${path.basename(dir) || dir}”？`,
      detail,
      checkboxLabel:
        info.managed > 0 ? `同时把图库里的 ${info.managed} 张副本移到回收站` : undefined,
      checkboxChecked: false,
    });
    if (response !== 0) return;

    // 先停止监听，避免移除的同时又被监听器重新导入
    for (const root of roots) {
      watchers.remove(root);
      watcher.unwatch(root);
    }
    const removed = images.removeFolder(dir);
    await deleteThumbs(removed);

    // 托管副本：用户勾选才处理；只处理位于图库目录内的普通文件，并且是移到回收站
    let trashed = 0;
    if (checkboxChecked) {
      for (const r of removed) {
        if (!r.managed || !isRegularFile(r.path) || !isInsideReal(libraryDir, r.path)) continue;
        try {
          await shell.trashItem(r.path);
          trashed++;
        } catch (err) {
          log.error("trash failed:", r.path, (err as Error).message);
        }
      }
    }

    broadcast("library:changed");
    broadcast("library:folder-removed", dir);
    say(`已从图库移除 ${removed.length} 张图片${trashed ? `，${trashed} 张副本已移到回收站` : ""}`);
  }

  return {
    popupMenu(win, dir) {
      if (typeof dir !== "string" || !images.hasDir(dir)) return false;
      const exists = isDirectory(dir);
      const watching = watchRoots(dir).length > 0;
      Menu.buildFromTemplate([
        { label: "在文件夹中打开", enabled: exists, click: () => void shell.openPath(dir) },
        { type: "separator" },
        watching
          ? { label: "停止监听", click: runSafely("folders", () => stopWatching(win, dir)) }
          : {
              label: "开始监听",
              enabled: exists,
              click: runSafely("folders", () => startWatching(dir)),
            },
        { type: "separator" },
        { label: "从图库移除…", click: runSafely("folders", () => removeFolder(win, dir)) },
      ]).popup({ window: win ?? undefined });
      return true;
    },
  };
}
