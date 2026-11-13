import { handle } from "../../core/ipc";
import { cleanTag, toId } from "../../core/sanitize";
import type { SmartAlbumsRepository, TagsRepository } from "../../db/repositories";
import { popupSmartMenu } from "./menu";
import { cleanRule } from "./rule";

export function registerSmartAlbumsIpc({
  smartAlbums,
  tags,
}: {
  smartAlbums: SmartAlbumsRepository;
  tags: Pick<TagsRepository, "existingTagNames">;
}): void {
  // 返回 { id, dropped } 或 { error }。不存在的标签直接忽略（dropped 里是被忽略的），按存在的标签创建
  handle("library:smart-create", (_ctx, name, rule) => {
    const title = cleanTag(name);
    const clean = cleanRule(rule);
    const asked = clean.tags;
    clean.tags = tags.existingTagNames(asked);
    const dropped = asked.filter((n) => !clean.tags.includes(n));
    if (!title) return { error: "请填写分类名称" };
    if (!(clean.days || clean.tags.length || clean.minSizeMB || clean.favorite)) {
      return {
        error: asked.length ? "填写的标签都不存在，请先给图片添加标签" : "至少设置一个条件",
      };
    }
    return { id: smartAlbums.add(title, clean), dropped };
  });

  handle("library:smart-menu", ({ window }, id, name) => {
    const albumId = toId(id);
    if (!albumId) return { ok: false };
    popupSmartMenu(smartAlbums, window, albumId, cleanTag(name)); // name 只用来显示在确认框里，真正删除只认 id
    return { ok: true };
  });

  handle("library:smart-rename", (_ctx, id, name) => {
    const albumId = toId(id);
    const title = cleanTag(name);
    if (!albumId) return { ok: false, error: "找不到这个智能分类" };
    if (!title) return { ok: false, error: "名称不能为空" };
    return smartAlbums.rename(albumId, title)
      ? { ok: true, name: title }
      : { ok: false, error: "这个智能分类已不存在" };
  });

  handle("library:smart-delete", (_ctx, id) => {
    const albumId = toId(id);
    if (albumId) smartAlbums.remove(albumId);
    return !!albumId;
  });
}
