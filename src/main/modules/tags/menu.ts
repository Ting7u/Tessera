// 侧边栏标签管理：只通过系统原生的右键菜单和确认框操作（和文件夹的右键菜单一致）。
// - 重命名：菜单项只通知界面“该标签进入重命名”，输入在界面里完成，提交时再走 library:tag-rename
// - 删除：确认后从所有图片上摘掉这个标签，图片本身不受影响
import { Menu, type BrowserWindow } from "electron";
import { broadcast } from "../../core/ipc";
import { showMessageBox } from "../../core/dialogs";
import { runSafely } from "../../core/menu";
import { say } from "../../core/notify";
import type { TagsRepository } from "../../db/repositories";

type TagsApi = Pick<TagsRepository, "tagInfo" | "deleteTag" | "renameTag">;

async function deleteTag(tags: TagsApi, win: BrowserWindow | null, name: string): Promise<void> {
  const info = tags.tagInfo(name);
  if (!info.count) return;
  let detail = `将从 ${info.count} 张图片上移除这个标签，图片本身不会被删除。`;
  if (info.smart.length)
    detail += `\n\n以下智能分类按这个标签筛选，删除后会变成空的：${info.smart.join("、")}`;
  const { response } = await showMessageBox(win, {
    type: "warning",
    buttons: ["删除标签", "取消"],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
    title: "删除标签",
    message: `删除标签“${name}”？`,
    detail,
  });
  if (response !== 0) return;
  tags.deleteTag(name);
  broadcast("library:changed");
  broadcast("library:tag-removed", name);
  say(`已删除标签“${name}”`);
}

/** 弹出标签的右键菜单 */
export function popupTagMenu(tags: TagsApi, win: BrowserWindow | null, name: string): void {
  Menu.buildFromTemplate([
    { label: "重命名", click: () => broadcast("library:tag-rename-request", name) },
    { type: "separator" },
    { label: "删除标签…", click: runSafely("tags", () => deleteTag(tags, win, name)) },
  ]).popup({ window: win ?? undefined });
}

/** 新名字已经有图片在用时，合并前需要确认。返回 true 表示继续 */
export async function confirmMerge(
  tags: TagsApi,
  win: BrowserWindow | null,
  from: string,
  to: string,
): Promise<boolean> {
  if (!tags.tagInfo(to).count) return true;
  const { response } = await showMessageBox(win, {
    type: "question",
    buttons: ["合并", "取消"],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
    title: "合并标签",
    message: `标签“${to}”已存在`,
    detail: `继续会把“${from}”的所有图片并入“${to}”，“${from}”这个标签将不再存在。`,
  });
  return response === 0;
}
