import { showOpenDialog } from "../../core/dialogs";
import { handle } from "../../core/ipc";
import { cleanIds } from "../../core/sanitize";
import type { Mover } from "./mover";

const MAX_IDS = 5000;

export function registerMoveIpc({ mover }: { mover: Mover }): void {
  // 弹窗打开时先问一下：这些图片里有几张能移动
  handle("library:move-preview", (_ctx, ids) => mover.preview(cleanIds(ids, MAX_IDS)));

  handle("library:move-choose", async ({ window }) => {
    const result = await showOpenDialog(window, {
      title: "选择要移动到的文件夹",
      properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    mover.allowDir(result.filePaths[0]);
    return { canceled: false, dir: result.filePaths[0] };
  });

  handle("library:move", (_ctx, request) => {
    const ids = cleanIds(request?.ids, MAX_IDS);
    const dir = typeof request?.dir === "string" ? request.dir : "";
    if (!ids.length || !dir) return { ok: false, error: "参数不对" };
    return mover.move(ids, dir);
  });

  handle("library:undo-move", (_ctx, token) => mover.undo(token));
}
