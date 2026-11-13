import { useEffect, useRef } from "react";

export interface LoadMoreSentinelProps {
  onVisible: () => void;
  /** 变化时重新观察，所以一页没填满视口时会连续加载直到填满 */
  itemCount: number;
}

/** 放在列表末尾的“哨兵”：快滚动到底部（提前 800px）时触发 onVisible 加载下一页 */
export function LoadMoreSentinel({ onVisible, itemCount }: LoadMoreSentinelProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(
      (entries) => entries.some((entry) => entry.isIntersecting) && onVisible(),
      { rootMargin: "800px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [onVisible, itemCount]);

  return <div ref={ref} aria-hidden="true" style={{ height: 1 }} />;
}
