// 图片缓存：id → 界面数据（ViewItem）。
// 已选图片即使被搜索条件挤出当前列表，详情面板和标签弹窗也能从这里取到。
// 放在模块作用域而不是 zustand 状态里：它不参与渲染订阅，改它不应触发重渲染
// （需要界面刷新时，由调用方另外 set 一次 items）。
import type { ViewItem } from "@renderer/shared/lib";

const cache = new Map<number, ViewItem>();

// 按 id 取一张图，没有就返回 undefined
export const getCachedItem = (id: number): ViewItem | undefined => cache.get(id);

/** 记下一批图片，原样返回（方便 set({ items: remember(...) }) 这样写） */
export function remember(items: ViewItem[]): ViewItem[] {
  for (const item of items) cache.set(item.id, item);
  return items;
}

/** 更新缓存里某张图片的部分字段（图片不在缓存里则什么都不做） */
/** Partial<ViewItem> 的意思是"ViewItem 的所有字段都变成可选的" */
/*
 patchCachedItem(1, { favorite: true });          // 只改收藏
 patchCachedItem(1, { tags: ["风景", "夏天"] });   // 只改标签
 */
export function patchCachedItem(id: number, patch: Partial<ViewItem>): void {
  const cached = cache.get(id);
  if (cached) cache.set(id, { ...cached, ...patch });
}

/** 标签被重命名（to 为新名字）或删除（to 为 null）：把缓存里的旧名字替换掉 */
export function replaceTagInCache(from: string, to: string | null): void {
  for (const [id, item] of cache) {
    if (item.tags.includes(from)) cache.set(id, { ...item, tags: swapTag(item.tags, from, to) });
  }
}

/** 把标签数组里的 from 换成 to（to 为 null 就是删除），并去重 */
/* swapTag(["a", "b"], "a", "c")   // 把 a 重命名为 c */
export function swapTag(tags: string[], from: string, to: string | null): string[] {
  const out = tags.map((tag) => (tag === from ? to : tag)).filter((tag): tag is string => !!tag);
  return [...new Set(out)];
}

/** 测试用：清空缓存 */
export function clearItemCache(): void {
  cache.clear();
}
