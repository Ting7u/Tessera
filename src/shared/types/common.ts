/** 操作结果：成功，或带错误文本的失败 */
export type ActionResult = { ok: true } | { ok: false; error: string };

/** 主进程发给界面的一句话提示（下载进度、扩展触发的下载结果等） */
export interface Notice {
  text: string;
  /** 这是下载进度提示：提示条上显示“取消下载”按钮 */
  downloading?: boolean;
}

export type ThemeName = "dark" | "light";

export type DesktopPlatform = "win32" | "darwin" | "linux";
