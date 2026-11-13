// 应用生命周期：单实例、AppUserModelId、ready / activate / window-all-closed。
import { app, BrowserWindow } from "electron";
import { APP_ID } from "@shared/constants";
import { assertAllHandled } from "../core/ipc";
import { initI18n } from "../core/i18n";
import { registerScheme } from "../modules/protocol";
import { composeLibrary } from "./composition";
import { registerAppIpc } from "./ipc";
import { ensureAppDirs, resolveAppPaths } from "./paths";
import { createMainWindow, focusMainWindow } from "./window";

export function startApp(): void {
  registerScheme(); // 自定义协议必须在 ready 之前注册

  // 单实例：再次双击图标时，不开第二个窗口（否则两个进程会同时写同一个 SQLite 文件），而是把已有窗口带到前台
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) app.quit();
  app.on("second-instance", focusMainWindow);
  if (process.platform === "win32") app.setAppUserModelId(APP_ID); // 与 electron-builder.yml 里的 appId 一致，任务栏图标分组才正常

  const paths = resolveAppPaths();
  initI18n(paths.language); // 启动阶段的弹窗也要是对的语言，所以在图库初始化之前

  void app.whenReady().then(() => {
    if (!gotLock) return; // 第二个实例马上退出，不要初始化图库
    ensureAppDirs(paths);
    const library = composeLibrary(paths);
    registerAppIpc();
    assertAllHandled();
    createMainWindow(library.getImagePath);
    // Mac：关掉窗口后程序还在运行，点 Dock 图标时要重新打开一个窗口
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow(library.getImagePath);
    });
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
