import type { TagRenameResult } from "@shared/types";
import { api } from "@renderer/shared/api";
import { t } from "@renderer/shared/i18n";
import type { SliceCreator } from "../types";

export interface TagsSlice {
  /** 给一张图片加标签。主进程返回最新的标签列表，这里同步列表和缓存（详情面板读的是缓存） */
  addTag: (id: number, name: string) => Promise<void>;
  removeTag: (id: number, name: string) => Promise<void>;
  /** 给多张图片加同一个标签，成功返回 true（弹窗据此决定是否关闭） */
  addTagToMany: (ids: number[], name: string) => Promise<boolean>;
  /** 从多张图片上移除同一个标签 */
  removeTagFromMany: (ids: number[], name: string) => Promise<boolean>;
  /** 侧边栏重命名标签；新名字已存在时由主进程弹框确认合并。返回主进程的结果 */
  renameTag: (from: string, to: string) => Promise<TagRenameResult>;
}

export const createTagsSlice: SliceCreator<TagsSlice> = (_set, get) => ({
  // 标签变了，侧边栏的标签区（名字、数量）也要跟着刷新
  addTag: async (id, name) => {
    const tags = await api.tags.addTag(id, name);
    if (!tags) return;
    get().applyTagChanges([{ id, tags }]);
    void get().refreshSidebar();
  },

  removeTag: async (id, name) => {
    const tags = await api.tags.removeTag(id, name);
    if (!tags) return;
    get().applyTagChanges([{ id, tags }]);
    await get().refreshSidebar();
    // 正在按标签查看时：标签已经没人用了就回到全部图片；否则列表要重新加载（这张图不再属于该标签）
    const { active, sidebar } = get();
    if (!active.startsWith("tag:")) return;
    if (!sidebar.tags.some((tag) => tag.key === active)) get().selectCategory("all");
    else if (active === `tag:${name}`) void get().reloadLoaded();
  },

  addTagToMany: async (ids, name) => {
    if (!ids.length) return false;
    const results = await api.tags.addTagToMany(ids, name);
    if (!results?.length) return false;
    get().applyTagChanges(results);
    get().showToast(t("toast.tagAdded", { count: results.length, name }), {
      duration: 2500,
      type: "success",
    });
    await get().refreshSidebar();
    // 搜索词或智能分类可能按标签匹配，加完标签后列表内容会变
    const { active, query } = get();
    if (query.trim() || active.startsWith("smart:")) void get().reloadLoaded();
    return true;
  },

  removeTagFromMany: async (ids, name) => {
    if (!ids.length) return false;
    const results = await api.tags.removeTagFromMany(ids, name);
    if (!results) return false;
    get().applyTagChanges(results);
    await get().refreshSidebar();
    const { active, sidebar, query } = get();
    if (active.startsWith("tag:")) {
      // 正在看的标签已经没人用了就回到全部图片，否则列表要刷新（这些图片不再属于它）
      if (!sidebar.tags.some((tag) => tag.key === active)) {
        get().closeTag();
        get().selectCategory("all");
      } else if (active === `tag:${name}`) void get().reloadLoaded();
    } else if (query.trim() || active.startsWith("smart:")) void get().reloadLoaded();
    return true;
  },

  renameTag: async (from, to) => {
    const res = await api.tags.rename(from, to);
    if (!res.ok) {
      if (res.error) get().showToast(res.error, { duration: 3000 });
      return res;
    }
    if (res.name !== from) {
      get().replaceTag(from, res.name);
      await get().refreshSidebar();
      get().showToast(
        res.merged
          ? t("toast.tagMerged", { name: res.name })
          : t("toast.tagRenamed", { name: res.name }),
        { duration: 2500, type: "success" },
      );
      // 正在查看这个标签：跟着切到新名字
      if (get().active === `tag:${from}`) get().selectCategory(`tag:${res.name}`);
    }
    return res;
  },
});
