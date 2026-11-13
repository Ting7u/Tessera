import { broadcast, handle } from "../../core/ipc";
import { cleanIds, cleanTag, toId } from "../../core/sanitize";
import type { TagsRepository } from "../../db/repositories";
import { confirmMerge, popupTagMenu } from "./menu";

const MAX_IDS = 20000; // 批量打标签：限制数量，防止渲染进程传来过大的数组

export function registerTagsIpc({ tags }: { tags: TagsRepository }): void {
  handle("library:add-tag", (_ctx, id, name) => {
    const imageId = toId(id);
    const tag = cleanTag(name);
    if (!imageId || !tag) return null;
    try {
      return tags.addTag(imageId, tag);
    } catch {
      return null; // 图片已被删除等情况
    }
  });
  handle("library:add-tag-many", (_ctx, ids, name) => {
    const tag = cleanTag(name);
    const imageIds = cleanIds(ids, MAX_IDS);
    if (!tag || !imageIds.length) return null;
    try {
      return tags.addTagToMany(imageIds, tag);
    } catch {
      return null;
    }
  });
  handle("library:remove-tag-many", (_ctx, ids, name) => {
    const tag = cleanTag(name);
    const imageIds = cleanIds(ids, MAX_IDS);
    if (!tag || !imageIds.length) return null;
    try {
      return tags.removeTagFromMany(imageIds, tag);
    } catch {
      return null;
    }
  });
  handle("library:remove-tag", (_ctx, id, name) => {
    const imageId = toId(id);
    return imageId ? tags.removeTag(imageId, cleanTag(name)) : null;
  });

  handle("library:tag-menu", ({ window }, rawName) => {
    const name = cleanTag(rawName);
    if (!name || !tags.tagInfo(name).count) return { ok: false };
    popupTagMenu(tags, window, name);
    return { ok: true };
  });

  handle("library:tag-rename", async ({ window }, rawFrom, rawTo) => {
    const from = cleanTag(rawFrom);
    const to = cleanTag(rawTo);
    if (!from || !to) return { ok: false, error: "标签名不能为空" };
    if (from === to) return { ok: true, name: to };
    if (!(await confirmMerge(tags, window, from, to))) return { ok: false, canceled: true };
    try {
      const { merged } = tags.renameTag(from, to);
      broadcast("library:changed");
      return { ok: true, name: to, merged };
    } catch (err) {
      return { ok: false, error: `重命名失败：${(err as Error).message}` };
    }
  });
}
