import type { SidebarData } from "@shared/types";
import { api } from "@renderer/shared/api";
import type { SliceCreator } from "../types";

export interface SidebarSlice {
  /** 侧边栏的真实数据：各分类计数、文件夹、标签、智能分类 */
  sidebar: SidebarData;
  /** 重新读取侧边栏数据；文件夹 / 智能分类改名后，页面标题也要跟着变 */
  refreshSidebar: () => Promise<void>;
}

const EMPTY_SIDEBAR: SidebarData = {
  total: 0,
  recent: 0,
  duplicate: 0,
  favorites: 0,
  folders: [],
  tags: [],
  smart: [],
};

export const createSidebarSlice: SliceCreator<SidebarSlice> = (set, get) => ({
  sidebar: EMPTY_SIDEBAR,

  refreshSidebar: async () => {
    const sidebar = await api.library.sidebar();
    set({ sidebar, libraryTotal: sidebar.total });
    get().updateTitle();
  },
});
