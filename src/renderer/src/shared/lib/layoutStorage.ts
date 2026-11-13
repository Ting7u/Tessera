// 记住用户选的图片布局（localStorage）。排布算法本身在 layout.ts（纯函数）。
import { DEFAULT_LAYOUT, parseLayout, type LayoutChoice } from "./layout";

const STORAGE_KEY = "tessera.layout";

export function loadLayout(): LayoutChoice {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? parseLayout(JSON.parse(raw)) : null;
    if (parsed) return parsed;
  } catch {
    // 没存过或数据坏了，用默认值
  }
  return DEFAULT_LAYOUT;
}

export function saveLayout(layout: LayoutChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // 存不了（隐私模式、配额满）就算了，只是下次不记得
  }
}
