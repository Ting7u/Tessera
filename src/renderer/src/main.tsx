// 渲染进程入口。
// 顺序很重要：界面代码一加载就会读 window.api（语言初始值、平台……），所以必须先确保它存在——
// Electron 里由 preload 注入；浏览器单独调试（npm run dev 后直接开 localhost:5173）时在这里装上模拟实现。
import { createRoot } from "react-dom/client";
import "@fontsource/inter/400.css";
import "./shared/styles/index.scss";

async function start(): Promise<void> {
  if (!window.api) {
    // ? 如果没有挂在上 window.api 并且不在开发模式下，报错
    if (!import.meta.env.DEV)
      throw new Error("window.api 不存在: preload 没有加载");
    // ? 走到这里说明是开发模式 → 装模拟的 api
    const { installMockApi } = await import("./dev/mockApi");
    installMockApi();
  }

  // 动态导入：保证上面的 window.api 已经就绪，再执行界面模块（它们在加载时就会读 window.api）
  const { App } = await import("./app");
  const root = document.getElementById("root");
  if (!root) throw new Error("找不到 #root");
  createRoot(root).render(<App />);
}

void start();
