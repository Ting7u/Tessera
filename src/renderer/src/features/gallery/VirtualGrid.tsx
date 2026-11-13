import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  computeLayout,
  visibleBoxes,
  type LayoutMode,
  type LayoutResult,
  type LayoutSize,
  type ViewItem,
} from "@renderer/shared/lib";
import styles from "./VirtualGrid.module.scss";

const OVERSCAN = 1; // 视口上下各多渲染一屏，快速滚动时不会露白
const SNAP = 200; // 滚动位置按 200px 取整再更新：不是每滚 1px 都重新计算、重新渲染

const EMPTY: LayoutResult = { boxes: [], height: 0, maxBoxHeight: 0 };

export interface VirtualGridProps {
  items: ViewItem[];
  /** 滚动容器：虚拟列表要靠它知道滚到哪了 */
  scrollRef: RefObject<HTMLElement | null>;
  mode: LayoutMode;
  size: LayoutSize;
  renderItem: (item: ViewItem) => ReactNode;
}

/**
 * 虚拟列表：先按布局算出每张图的位置（shared/lib/layout，纯函数），再只渲染屏幕附近的那些，其余的不进 DOM。
 * 图片再多，页面上始终只有几十到一两百张卡片。
 */
export function VirtualGrid({ items, scrollRef, mode, size, renderItem }: VirtualGridProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [view, setView] = useState({ top: 0, height: 800 }); // 视口相对内容区顶部的位置

  // 内容区宽度（窗口缩放、侧边栏变化都会触发）
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    setWidth(Math.floor(el.clientWidth));
    return () => ro.disconnect();
  }, []);

  // 视口位置：监听滚动容器，用 requestAnimationFrame 合并成每帧最多一次
  useEffect(() => {
    const scroller = scrollRef.current;
    const content = contentRef.current;
    if (!scroller || !content) return undefined;
    let frame = 0;
    const update = (): void => {
      frame = 0;
      // 内容区顶部比视口顶部高出多少 = 已经滚过的距离（不用关心滚动容器的内边距）
      const top =
        Math.floor(
          (scroller.getBoundingClientRect().top - content.getBoundingClientRect().top) / SNAP,
        ) * SNAP;
      const height = Math.round(scroller.clientHeight);
      setView((prev) => (prev.top === top && prev.height === height ? prev : { top, height }));
    };
    const schedule = (): void => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    scroller.addEventListener("scroll", schedule, { passive: true });
    const ro = new ResizeObserver(schedule);
    ro.observe(scroller);
    return () => {
      cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", schedule);
      ro.disconnect();
    };
  }, [scrollRef]);

  // 位置只在 图片列表 / 宽度 / 布局 / 大小 变化时重算，滚动时不会重算
  const layout = useMemo(
    () => (width > 0 ? computeLayout(items, width, mode, size) : EMPTY),
    [items, width, mode, size],
  );

  const margin = view.height * OVERSCAN;
  const visible = visibleBoxes(layout, view.top - margin, view.top + view.height + margin);

  return (
    <div ref={contentRef} className={styles.content} style={{ height: layout.height }}>
      {visible.map((b) => {
        const item = items[b.i];
        return (
          <div
            key={item.id}
            className={styles.cell}
            style={{ left: b.x, top: b.y, width: b.w, height: b.h }}
          >
            {renderItem(item)}
          </div>
        );
      })}
    </div>
  );
}
