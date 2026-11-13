import { useEffect } from "react";
import { api } from "@renderer/shared/api";
import { useAppStore } from "@renderer/store";

let switching = 0; // 正在进行的主题切换数量（连续点击时可能叠加）

// 把主题写到 <html data-theme>。切换期间给 <html> 加上 theme-switching，
// base.scss 会据此关掉所有元素自己的颜色过渡，避免各元素不同步、继承的颜色互相拖后腿。
//   - 浏览器支持 View Transitions：整页淡入淡出，所有元素同步变化
//   - 不支持，或系统要求减少动画：直接切换（同样先关掉过渡），不会闪
function applyTheme(theme: string): void {
  const root = document.documentElement;
  const set = (): void => {
    root.dataset.theme = theme;
  };
  const done = (): void => {
    if (--switching === 0) root.classList.remove("theme-switching");
  };

  switching++;
  root.classList.add("theme-switching");

  // prefers-reduced-motion: reduce 是系统的"减少动态效果"设置,要尊重
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // 不支持或用户要求减少动画
  if (!document.startViewTransition || reduceMotion) {
    set();
    // 等浏览器在“没有过渡”的状态下画完新主题，再把过渡恢复
    requestAnimationFrame(() => requestAnimationFrame(done));
    return;
  }

  document
    .startViewTransition(set)
    .finished.catch(() => {
      // 过渡被打断（比如连续点击）不是错误，主题已经切过去了
    })
    .finally(done);
}

/** 把 store 里的 theme 同步到 <html data-theme> 以及桌面窗口（标题栏按钮的颜色） */
export function useThemeEffect(): void {
  const theme = useAppStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    if (!root.dataset.theme)
      root.dataset.theme = theme; // 启动时第一次：直接设置，不做动画
    else if (root.dataset.theme !== theme) applyTheme(theme); // 用户点了切换
    // 通知 Electron 主进程
    api.app.setTheme(theme);
  }, [theme]);
}
