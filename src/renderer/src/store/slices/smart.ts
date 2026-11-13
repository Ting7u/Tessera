import type { SmartCreateResult, SmartRenameResult, SmartRule } from "@shared/types";
import { api } from "@renderer/shared/api";
import type { SliceCreator } from "../types";

export interface SmartSlice {
  /** 返回 { id, dropped }（dropped：不存在而被忽略的标签）或 { error } */
  createSmart: (name: string, rule: Partial<SmartRule>) => Promise<SmartCreateResult>;
  renameSmartAlbum: (id: number, name: string) => Promise<SmartRenameResult>;
  /** 目前没有界面入口调用（删除走侧边栏右键菜单，由主进程发 smart-removed 事件），保留给以后用 */
  deleteSmart: (id: number) => Promise<void>;
}

export const createSmartSlice: SliceCreator<SmartSlice> = (_set, get) => ({
  createSmart: async (name, rule) => {
    const res = await api.smart.create(name, rule);
    if ("id" in res) await get().refreshSidebar();
    return res;
  },

  renameSmartAlbum: async (id, name) => {
    const res = await api.smart.rename(id, name);
    // 正在看它时页面标题要跟着改：refreshSidebar 里会按新名字重新算
    if (res.ok) await get().refreshSidebar();
    return res;
  },

  deleteSmart: async (id) => {
    await api.smart.remove(id);
    if (get().active === `smart:${id}`) get().selectCategory("all");
    void get().refreshSidebar();
  },
});
