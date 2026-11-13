import type { ViewItem } from "@renderer/shared/lib";
import { getCachedItem, useAppStore } from "@renderer/store";

/**
 * 详情面板要展示的图片：优先用 detailId（点击图片打开），否则取最后一个被选中的图片。
 * 从缓存取，所以搜索条件变化后也不会丢。
 */
export function useFocusedItem(): ViewItem | null {
  return useAppStore((s) => {
    const id = s.detailId ?? s.selected[s.selected.length - 1];
    return id === undefined || id === null ? null : (getCachedItem(id) ?? null);
  });
}
