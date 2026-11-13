// 各弹窗的开关和参数。加一个弹窗：这里加 showX / openX / closeX，在 app/App.tsx 里用 <Presence> 挂上。
// 关闭时参数故意不清空：弹窗的退出动画还在播放，内容要保持不变；下次 open 会重新设置。
import type { SliceCreator } from "../types";

export interface RenameSmartTarget {
  id: number;
  name: string;
}

export interface DialogsSlice {
  showImport: boolean;
  showSmart: boolean;
  showSettings: boolean;
  /** “移动到文件夹”弹窗 */
  showMove: boolean;
  moveIds: number[];
  /** “标签”弹窗（给一张或多张图片加/删标签） */
  showTag: boolean;
  tagIds: number[];
  showRenameSmart: boolean;
  renameSmartTarget: RenameSmartTarget | null;
  showRenameTag: boolean;
  renameTagFrom: string | null;

  openImport: () => void;
  closeImport: () => void;
  openSmart: () => void;
  closeSmart: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  openMove: (ids: number[]) => void;
  closeMove: () => void;
  openTag: (ids: number[]) => void;
  closeTag: () => void;
  openRenameTag: (name: string) => void;
  closeRenameTag: () => void;
  openRenameSmart: (target: RenameSmartTarget) => void;
  closeRenameSmart: () => void;
}

export const createDialogsSlice: SliceCreator<DialogsSlice> = (set) => ({
  showImport: false,
  showSmart: false,
  showSettings: false,
  showMove: false,
  moveIds: [],
  showTag: false,
  tagIds: [],
  showRenameSmart: false,
  renameSmartTarget: null,
  showRenameTag: false,
  renameTagFrom: null,

  openImport: () => set({ showImport: true }),
  closeImport: () => set({ showImport: false }),
  openSmart: () => set({ showSmart: true }),
  closeSmart: () => set({ showSmart: false }),
  openSettings: () => set({ showSettings: true }),
  closeSettings: () => set({ showSettings: false }),
  openMove: (ids) => set({ showMove: true, moveIds: ids }),
  closeMove: () => set({ showMove: false }),
  openTag: (ids) => set({ showTag: true, tagIds: ids }),
  closeTag: () => set({ showTag: false }),
  openRenameTag: (name) => set({ showRenameTag: true, renameTagFrom: name }),
  closeRenameTag: () => set({ showRenameTag: false }),
  openRenameSmart: (target) => set({ showRenameSmart: true, renameSmartTarget: target }),
  closeRenameSmart: () => set({ showRenameSmart: false }),
});
