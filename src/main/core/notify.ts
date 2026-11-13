// 主进程 → 界面的通知工具：进度限流、列表变更限流、一句话提示（必要时同时弹系统通知）。
import { BrowserWindow, Notification } from "electron";
import type { Notice } from "@shared/types";
import { APP_NAME } from "@shared/constants";
import type { ImportProgress } from "@shared/types";
import { broadcast } from "./ipc";

/** 进度事件限流：最多 10 次/秒，结束事件一定发送 */
export function createProgressEmitter(): (state: ImportProgress) => void {
  let last = 0;
  return (state) => {
    const now = Date.now();
    if (!state.finished && now - last < 100) return;
    last = now;
    broadcast("library:progress", { ...state });
  };
}

/** 列表变更通知限流：最多 1 次/秒 */
export function createChangedNotifier(): () => void {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (timer) return;
    const fire = (): void => {
      last = Date.now();
      timer = null;
      broadcast("library:changed");
    };
    timer = setTimeout(fire, Math.max(0, 1000 - (Date.now() - last)));
  };
}

/** 只更新界面上的提示条（不弹系统通知） */
export const say = (text: string): void => broadcast("library:notice", { text });

export type Notify = (notice: Notice, quiet?: boolean) => void;

/**
 * 主进程主动发给界面的提示（例如浏览器扩展触发的下载结果）。
 * 界面没有被激活（窗口在后台或最小化）时，同时弹一条系统通知，免得用户看不到
 */
export function createNotifier(): Notify {
  return (notice, quiet = false) => {
    broadcast("library:notice", notice);
    if (quiet) return; // 进度类提示只更新界面，不弹系统通知
    const focused = BrowserWindow.getAllWindows().some((w) => w.isFocused());
    if (!focused && Notification.isSupported()) {
      new Notification({ title: APP_NAME, body: notice.text }).show();
    }
  };
}
