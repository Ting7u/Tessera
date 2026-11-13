import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useT } from "@renderer/shared/i18n";
import type { ViewItem } from "@renderer/shared/lib";
import styles from "./DetailPanel.module.scss";

const SKELETON_DELAY = 80; // 毫秒：切换图片时，新图超过这个时间还没好，才把上一张换成骨架框

interface Shown {
  id: number;
  /** null：所有来源都加载失败，显示渐变占位 */
  src: string | null;
  fade: boolean;
}

export interface DetailImageProps {
  item: ViewItem;
  /** 原图加载失败时调用（交给外面判断文件是不是丢了） */
  onOriginalError?: () => void;
}

// 详情大图。
// - 点开详情时立刻显示骨架框（按图片宽高比占位），图片在后台完全解码后再整张淡入替换，不会“从上到下”一行行刷出来
// - 用箭头切换时，新图没好之前先留着上一张；快的话直接无缝替换，超过 80ms 才换成骨架框，避免一闪而过
// - 依次尝试：原图 → 缩略图，前一级失败就退到下一级；全失败显示渐变占位
export function DetailImage({ item, onOriginalError }: DetailImageProps) {
  const t = useT();
  const sources = useMemo(
    () =>
      [
        item.original ? { kind: "original" as const, src: item.original } : null,
        item.thumb ? { kind: "thumb" as const, src: item.thumb } : null,
      ].filter((s) => s !== null),
    [item.original, item.thumb],
  );

  const [shown, setShown] = useState<Shown | null>(null); // 已解码完成、正在显示的图片
  const [skeletonFor, setSkeletonFor] = useState<number | null>(null); // 哪张图的骨架框已经到了该出现的时候
  const shownRef = useRef<Shown | null>(null);
  const errorRef = useRef(onOriginalError);
  useEffect(() => {
    errorRef.current = onOriginalError;
  });

  useEffect(() => {
    const id = item.id;
    // 这张图已经在显示了（比如缩略图稍后才生成导致 sources 变化），不重复加载
    if (shownRef.current?.id === id && shownRef.current.src) return undefined;

    let cancelled = false;
    let skeletonShown = !shownRef.current; // 没有上一张可留着时，骨架框一开始就在
    const timer = setTimeout(() => {
      skeletonShown = true;
      setSkeletonFor(id);
    }, SKELETON_DELAY);

    const commit = (src: string | null): void => {
      clearTimeout(timer);
      const next: Shown = { id, src, fade: skeletonShown }; // 只有从骨架框换过来才淡入；图换图直接替换
      shownRef.current = next;
      setShown(next);
    };

    void (async () => {
      for (const { kind, src } of sources) {
        try {
          const img = new Image();
          img.src = src;
          await img.decode(); // 读取并解码完成才算好
          if (!cancelled) commit(src);
          return;
        } catch {
          if (cancelled) return;
          if (kind === "original") errorRef.current?.();
        }
      }
      if (!cancelled) commit(null); // 所有来源都失败
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [item.id, sources]);

  const current = shown && shown.id === item.id ? shown : null;
  const stale = shown && shown.id !== item.id && shown.src ? shown : null; // 上一张

  if (current) {
    if (!current.src) {
      return (
        <div
          className={styles.placeholder}
          style={{
            aspectRatio: item.ratio,
            background: `linear-gradient(145deg, hsl(${item.hue} 35% 49%), hsl(${(item.hue + 42) % 360} 38% 18%))`,
          }}
        />
      );
    }
    return (
      <img
        key={current.src}
        className={current.fade ? styles.fadeIn : undefined}
        src={current.src}
        alt={item.name}
        draggable={false}
      />
    );
  }

  // 新图还没好：先留着上一张，超过 SKELETON_DELAY 才换成骨架框
  if (stale && skeletonFor !== item.id) {
    return <img key={stale.src ?? ""} src={stale.src ?? ""} alt="" draggable={false} />;
  }

  return (
    <div
      className={styles.skeleton}
      // --ratio 是自定义属性，不在 CSSProperties 的类型里；只传一个数字，运行时是安全的
      style={{ "--ratio": item.ratio } as CSSProperties}
      role="status"
      aria-label={t("detail.loading")}
    />
  );
}
