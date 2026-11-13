// 系统对话框：窗口可能已经关闭（window 为 null），这时弹无父窗口的对话框。
import {
  dialog,
  type BrowserWindow,
  type MessageBoxOptions,
  type OpenDialogOptions,
} from "electron";

export function showMessageBox(win: BrowserWindow | null, options: MessageBoxOptions) {
  return win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options);
}

export function showOpenDialog(win: BrowserWindow | null, options: OpenDialogOptions) {
  return win ? dialog.showOpenDialog(win, options) : dialog.showOpenDialog(options);
}
