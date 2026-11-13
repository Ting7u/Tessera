import type { CSSProperties } from "react";

// 标签颜色：根据标签名算出一个固定的色相（0-360），同一个标签在任何地方颜色都一样。
// 只输出色相，具体的饱和度、明度、透明度写在样式里，这样深色和浅色主题都能用。
export function tagHue(name: string): number {
  let hash = 2166136261; // FNV-1a
  for (const ch of String(name)) {
    hash ^= ch.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 360;
}

/** 用法：<button style={tagStyle(name)}>，样式里用 hsl(var(--tag-h) 70% 55%) */
export const tagStyle = (name: string): CSSProperties =>
  // CSS 自定义属性不在 CSSProperties 的类型里；这里只传一个数字变量，运行时是安全的
  ({ "--tag-h": tagHue(name) }) as CSSProperties;
