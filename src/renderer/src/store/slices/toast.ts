import type { ToastAction, ToastType } from "@renderer/shared/ui";
import type { SliceCreator } from "../types";

export interface ShowToastOptions {
  /** 显示多久（毫秒），默认 5000；0 表示一直显示，直到下一次 showToast（用于“正在下载…”） */
  duration?: number;
  /** info（默认，底部深色条）| success（顶部绿色泡泡） */
  type?: ToastType;
  /** 提示上的操作按钮，例如“撤销” */
  action?: ToastAction | null;
  /** 这是下载进度提示：提示条上显示“取消下载”按钮（由主进程的 Notice.downloading 决定，不再靠文字判断） */
  downloading?: boolean;
}

export interface ToastSlice {
  toast: string | null;
  toastType: ToastType;
  toastAction: ToastAction | null;
  toastDownloading: boolean;
  /** 每次提示自增，让连续两次相同文字的提示也能重新播放动画 */
  toastId: number;
  showToast: (text: string, options?: ShowToastOptions) => void;
  dismissToast: () => void;
}
/*
  存"自动消失"的定时器 id。放在函数外面、模块顶层，是因为多次调用 showToast 要共享同一个
  timer：新提示来了，要取消旧的定时器。它不放进 store，是因为这个值不影响界面，不需要触发渲染
 */
let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const createToastSlice: SliceCreator<ToastSlice> = (set) => ({
  toast: null,
  toastType: "info",
  toastAction: null,
  toastDownloading: false,
  toastId: 0,

  showToast: (
    text,
    { duration = 5000, type = "info", action = null, downloading = false } = {},
  ) => {
    clearTimeout(toastTimer);
    set((state) => ({
      toast: text,
      toastType: type,
      toastAction: action,
      toastDownloading: downloading,
      toastId: state.toastId + 1,
    }));
    if (duration > 0) toastTimer = setTimeout(() => set({ toast: null }), duration);
  },

  dismissToast: () => {
    clearTimeout(toastTimer);
    set({ toast: null, toastAction: null });
  },
});
