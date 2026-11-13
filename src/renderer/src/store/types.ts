// 全局状态的总类型：各 slice 的类型拼在一起。
// slice 之间需要互相调用时用 get()（它的类型就是 AppState），不要 import 对方的运行时代码。
import type { StateCreator } from "zustand";
import type { DetailSlice } from "./slices/detail";
import type { DialogsSlice } from "./slices/dialogs";
import type { DownloadsSlice } from "./slices/downloads";
import type { FavoritesSlice } from "./slices/favorites";
import type { GallerySlice } from "./slices/gallery";
import type { ImportProgressSlice } from "./slices/importProgress";
import type { MoveSlice } from "./slices/move";
import type { SelectionSlice } from "./slices/selection";
import type { SidebarSlice } from "./slices/sidebar";
import type { SmartSlice } from "./slices/smart";
import type { TagsSlice } from "./slices/tags";
import type { ThemeSlice } from "./slices/theme";
import type { ToastSlice } from "./slices/toast";

export type AppState = GallerySlice &
  SidebarSlice &
  SelectionSlice &
  DetailSlice &
  DialogsSlice &
  ToastSlice &
  ThemeSlice &
  ImportProgressSlice &
  TagsSlice &
  SmartSlice &
  FavoritesSlice &
  DownloadsSlice &
  MoveSlice;

/** 写 slice 的统一类型：整个 AppState 都能 get()/set()，但只需返回自己这一块 */
export type SliceCreator<TSlice> = StateCreator<AppState, [], [], TSlice>;
