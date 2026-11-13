// 全局状态：把各领域的 slice 合成一个 useAppStore。
// 只有跨组件共享的状态才放这里；弹窗内部的输入框内容、是否忙碌之类的局部状态用 useState。
// 与主进程的事件同步在 ./librarySync（由 app/App.tsx 调用，不从这里再导出，避免循环引用）。
// 订阅时只选自己需要的字段：useAppStore((s) => s.items)。
import { create } from "zustand";
import { useI18nStore } from "@renderer/shared/i18n";
import { createDetailSlice } from "./slices/detail";
import { createDialogsSlice } from "./slices/dialogs";
import { createDownloadsSlice } from "./slices/downloads";
import { createFavoritesSlice } from "./slices/favorites";
import { createGallerySlice } from "./slices/gallery";
import { createImportProgressSlice } from "./slices/importProgress";
import { createMoveSlice } from "./slices/move";
import { createSelectionSlice } from "./slices/selection";
import { createSidebarSlice } from "./slices/sidebar";
import { createSmartSlice } from "./slices/smart";
import { createTagsSlice } from "./slices/tags";
import { createThemeSlice } from "./slices/theme";
import { createToastSlice } from "./slices/toast";
import type { AppState } from "./types";

/*
 * const step1 = create<AppState>(); // 返回一个函数
 * export const useAppStore = step1((...args) => ({ ... }));   // 再调用它
 * (...args) => ({ ... }): zustand 会调用它一次，并传入 set, get, api 三个参数
 */
export const useAppStore = create<AppState>()((...args) => ({
  ...createGallerySlice(...args),
  ...createSidebarSlice(...args),
  ...createSelectionSlice(...args),
  ...createDetailSlice(...args),
  ...createDialogsSlice(...args),
  ...createToastSlice(...args),
  ...createThemeSlice(...args),
  ...createImportProgressSlice(...args),
  ...createTagsSlice(...args),
  ...createSmartSlice(...args),
  ...createFavoritesSlice(...args),
  ...createDownloadsSlice(...args),
  ...createMoveSlice(...args),
}));

// 切换语言时，页面标题要重新算一遍（标题是算好存在 store 里的）
useI18nStore.subscribe(() => useAppStore.getState().updateTitle());

export { getCachedItem } from "./itemCache";
export type { AppState } from "./types";
export type { RenameSmartTarget } from "./slices/dialogs";
export { PAGE } from "./slices/gallery";
