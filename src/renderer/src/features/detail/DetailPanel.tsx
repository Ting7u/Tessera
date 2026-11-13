import { useEffect, useRef, useState } from "react";
import { api } from "@renderer/shared/api";
import { useEscapeKey } from "@renderer/shared/hooks";
import { useT } from "@renderer/shared/i18n";
import { Icon } from "@renderer/shared/ui";
import { useAppStore } from "@renderer/store";
import { DetailImage } from "./DetailImage";
import { ImageActions } from "./ImageActions";
import { TagEditor } from "./TagEditor";
import { useFocusedItem } from "./useFocusedItem";
import styles from "./DetailPanel.module.scss";

// 左右切换图片用的箭头
function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={dir === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
    </svg>
  );
}

// 全屏详情层：黑色遮罩 + 上方大图 + 下方信息。点遮罩空白处或按 Esc 关闭；← → 或两侧箭头切换上一张 / 下一张
export function DetailPanel() {
  const t = useT();
  const showDetail = useAppStore((s) => s.showDetail);
  const closeDetail = useAppStore((s) => s.closeDetail);
  const stepDetail = useAppStore((s) => s.stepDetail);
  // 当前图片在已加载列表里的位置。详情没打开时不计算，免得每次状态变化都白白遍历整个列表
  const index = useAppStore((s) =>
    s.showDetail ? s.items.findIndex((i) => i.id === s.detailId) : -1,
  );
  const loadedCount = useAppStore((s) => s.items.length);
  const hasMorePages = useAppStore((s) => s.items.length < s.total);
  const item = useFocusedItem();
  const [fileMissing, setFileMissing] = useState(false); // 原文件已不在磁盘上（被删除或移动）
  const preloaded = useRef<HTMLImageElement[]>([]); // 持有预加载的图片对象，避免预加载结果被过早回收

  const hasPrev = index > 0;
  // 已加载的最后一张但还有下一页，也算有下一张
  const hasNext = index >= 0 && (index < loadedCount - 1 || hasMorePages);

  // 切换图片时重置“原文件丢失”的提示
  useEffect(() => {
    setFileMissing(false);
  }, [item?.id]);

  // Esc 关闭（菜单打开时 Menu 会在捕获阶段拦住 Esc，只关菜单）
  useEscapeKey(closeDetail, showDetail);

  // ← → 切换图片（只在打开时监听）
  useEffect(() => {
    if (!showDetail) return undefined;
    const onKey = (event: KeyboardEvent): void => {
      // 在输入框里（比如添加标签）按左右键是移动光标，不切换图片
      const el = event.target;
      if (
        el instanceof HTMLElement &&
        (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))
      ) {
        return;
      }
      if (event.key === "ArrowLeft") void stepDetail(-1);
      else if (event.key === "ArrowRight") void stepDetail(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showDetail, stepDetail]);

  // 详情打开时整个窗口是黑色遮罩：右上角系统按钮的图标临时换成浅色（浅色主题下它们原本是深色，会看不见），关闭后恢复
  useEffect(() => {
    if (!showDetail) return undefined;
    api.app.setTheme("dark");
    return () => api.app.setTheme(useAppStore.getState().theme);
  }, [showDetail]);

  // 提前加载前后两张，按箭头切换时不用等。只预读文件，不 decode：同时解码好几张超大原图会占满内存
  useEffect(() => {
    if (!showDetail || !item) {
      preloaded.current = [];
      return;
    }
    const { items } = useAppStore.getState();
    const i = items.findIndex((x) => x.id === item.id);
    const keep: HTMLImageElement[] = [];
    for (const near of [items[i + 1], items[i - 1]]) {
      if (!near) continue;
      const img = new Image();
      img.src = near.original;
      keep.push(img);
    }
    preloaded.current = keep;
  }, [showDetail, item?.id]);

  if (!showDetail || !item) return null;

  const fullPath = item.path || (item.managed ? t("detail.managed") : "—");
  const reveal = (): void => void api.images.reveal(item.id);

  // 原图加载失败有两种可能：文件已经不在了，或者浏览器解码不了这种格式（比如 HEIC）。
  // DetailImage 会自动退回缩略图；这里再问主进程文件还在不在，只有确实不在才提示“原文件已丢失”
  const onOriginalError = (): void => {
    const id = item.id;
    api.images
      .fileExists(id)
      .then((exists) => {
        if (useAppStore.getState().detailId === id) setFileMissing(exists === false);
      })
      .catch(() => {
        // 查不到就不提示，只是少一句说明
      });
  };

  return (
    <div className={styles.overlay} onClick={closeDetail}>
      <aside className={styles.dialog} onClick={(event) => event.stopPropagation()}>
        <div className={styles.head}>
          <div className={styles.name}>
            <b title={item.name}>{item.name}</b>
            <span>{t("detail.imported", { date: item.addedDate })}</span>
          </div>
          <button aria-label={t("detail.close")} onClick={closeDetail}>
            <Icon name="close" />
          </button>
        </div>

        <div className={styles.stage}>
          <DetailImage item={item} onOriginalError={onOriginalError} />

          {fileMissing && (
            <div className={styles.missing} role="status">
              {t("detail.fileMissing", {
                settings: t("settings.title"),
                maintenance: t("settings.section.maintenance"),
              })}
            </div>
          )}

          {hasPrev && (
            <button
              className={`${styles.nav} ${styles.prev}`}
              aria-label={t("detail.prev")}
              title={t("detail.prevHint")}
              onClick={() => void stepDetail(-1)}
            >
              <Chevron dir="left" />
            </button>
          )}
          {hasNext && (
            <button
              className={`${styles.nav} ${styles.next}`}
              aria-label={t("detail.next")}
              title={t("detail.nextHint")}
              onClick={() => void stepDetail(1)}
            >
              <Chevron dir="right" />
            </button>
          )}
        </div>

        <div className={styles.info}>
          <div className={styles.section}>
            <ImageActions key={item.id} id={item.id} />
          </div>

          <div className={styles.section}>
            <span className={styles.label}>{t("detail.basicInfo")}</span>
            <dl>
              <div>
                <dt>{t("detail.dimensions")}</dt>
                <dd>{item.dimensions}</dd>
              </div>
              <div>
                <dt>{t("detail.fileSize")}</dt>
                <dd>{item.size}</dd>
              </div>
              <div>
                <dt>{t("detail.format")}</dt>
                <dd>{item.format || "—"}</dd>
              </div>
              <div>
                <dt>{t("detail.location")}</dt>
                <dd
                  className={`${styles.path} ${styles.link}`}
                  title={t("detail.revealHint", { path: fullPath })}
                  role="button"
                  tabIndex={0}
                  onClick={reveal}
                  onKeyDown={(event) => event.key === "Enter" && reveal()}
                >
                  {fullPath}
                </dd>
              </div>
            </dl>
          </div>

          <div className={styles.section}>
            <span className={styles.label}>{t("tag.title")}</span>
            <TagEditor id={item.id} tags={item.tags} />
          </div>

          <div className={styles.section}>
            <span className={styles.label}>{t("detail.exif")}</span>
            {item.exifRows.length ? (
              <dl>
                {item.exifRows.map((row) => (
                  <div key={row.id}>
                    <dt>{t(`exif.${row.id}`)}</dt>
                    <dd title={row.value}>{row.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className={styles.hint}>{t("detail.noExif")}</p>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
