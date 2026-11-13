// 侧边栏智能分类的右键菜单（和文件夹、标签一样用系统原生菜单）。
import { Menu, type BrowserWindow } from "electron";
import { showMessageBox } from "../../core/dialogs";
import { broadcast } from "../../core/ipc";
import type { SmartAlbumsRepository } from "../../db/repositories";

/** 删除前弹框确认；删完通知界面：正在看这个分类就回到“全部图片”，侧边栏刷新 */
export function popupSmartMenu(
  smartAlbums: Pick<SmartAlbumsRepository, "remove">,
  win: BrowserWindow | null,
  id: number,
  title: string,
): void {
  Menu.buildFromTemplate([
    // 重命名：通知界面弹出重命名弹窗（和标签的重命名一样）
    {
      label: "重命名",
      click: () => broadcast("library:smart-rename-request", { id, name: title }),
    },
    { type: "separator" },
    {
      label: "删除智能分类…",
      click: async () => {
        const { response } = await showMessageBox(win, {
          type: "warning",
          buttons: ["删除", "取消"],
          defaultId: 1,
          cancelId: 1,
          noLink: true,
          message: title ? `删除智能分类“${title}”？` : "删除这个智能分类？",
          detail: "只会删除这个分类，不会删除其中的图片。",
        });
        if (response !== 0) return;
        smartAlbums.remove(id);
        broadcast("library:smart-removed", id);
        broadcast("library:changed");
      },
    },
  ]).popup({ window: win ?? undefined });
}
