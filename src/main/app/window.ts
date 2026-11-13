// 主窗口：创建、标题栏主题、记住窗口引用（单实例时把已有窗口带到前台用）。
import path from "node:path";
import { BrowserWindow } from "electron";
import type { ThemeName } from "@shared/types";
import icon from "../../../resources/icon.png?asset"; // Linux 窗口图标（Windows / Mac 用安装包里嵌入的图标）
import { APP_NAME } from "@shared/constants";
import { setupImageContextMenu } from "./imageContextMenu";

export const titleBarThemes: Record<ThemeName, { color: string; symbolColor: string }> = {
  dark: { color: "rgba(0, 0, 0, 0)", symbolColor: "#e9e6df" },
  light: { color: "rgba(0, 0, 0, 0)", symbolColor: "#24262c" },
};
const TITLE_BAR_HEIGHT = 32;

let mainWindow: BrowserWindow | null = null;

export const getMainWindow = (): BrowserWindow | null => mainWindow;

/** 单实例：已有窗口带到前台 */
export function focusMainWindow(): void {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

/** 切换标题栏按钮颜色。Mac 没有 titleBarOverlay，按钮颜色由系统跟随 */
export function applyTitleBarTheme(win: BrowserWindow | null, theme: ThemeName): void {
  if (process.platform === "darwin") return;
  const titleBarTheme = Object.hasOwn(titleBarThemes, theme) ? titleBarThemes[theme] : undefined;
  if (win && titleBarTheme) {
    try {
      win.setTitleBarOverlay({ ...titleBarTheme, height: TITLE_BAR_HEIGHT });
    } catch (err) {
      console.error("[titlebar] setTitleBarOverlay failed:", err);
    }
  }
}

export function createMainWindow(getImagePath: (id: number) => string | null): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: APP_NAME,
    backgroundColor: "#14161b",
    titleBarStyle: "hidden",
    // Mac：红黄绿按钮由系统画在左上角，不需要 titleBarOverlay。y=17 让按钮和标题栏里 logo 的中线（约 y=23）对齐
    // Windows / Linux：窗口按钮靠 titleBarOverlay 画在右上角
    ...(process.platform === "darwin"
      ? { trafficLightPosition: { x: 14, y: 17 } }
      : { titleBarOverlay: { ...titleBarThemes.dark, height: TITLE_BAR_HEIGHT } }),
    ...(process.platform === "linux" ? { icon } : {}),
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "../preload/index.js"),
    },
  });
  mainWindow = win;
  win.on("closed", () => {
    mainWindow = null;
  });
  win.setMenuBarVisibility(false);
  setupImageContextMenu(win, getImagePath);

  const devUrl = process.env["ELECTRON_RENDERER_URL"]; // electron-vite 开发模式下注入
  if (devUrl) void win.loadURL(devUrl);
  else void win.loadFile(path.join(__dirname, "../renderer/index.html"));
  return win;
}
