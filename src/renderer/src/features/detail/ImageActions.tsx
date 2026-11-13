import { useEffect, useRef, useState } from "react";
import { api } from "@renderer/shared/api";
import { useT } from "@renderer/shared/i18n";
import { Icon } from "@renderer/shared/ui";
import { getCachedItem, useAppStore } from "@renderer/store";
import styles from "./DetailPanel.module.scss";

export interface ImageActionsProps {
  id: number;
}

// 详情面板的四个操作按钮：查看（系统看图软件）、复制（图片到剪贴板）、收藏、更多（系统菜单）
export function ImageActions({ id }: ImageActionsProps) {
  const t = useT();
  // copied: false | "image"（图片已复制） | "path"（只复制了文件路径）
  const [copied, setCopied] = useState<false | "image" | "path">(false);
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
    };
  }, []);

  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  // 优先读当前列表里的状态；图片被搜索条件挤出列表时退回缓存
  const favorite = useAppStore((s) => {
    const item = s.items.find((i) => i.id === id);
    return item ? item.favorite : getCachedItem(id)?.favorite;
  });

  const fail = (message: string): void => {
    setError(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setError(""), 4000);
  };

  const open = async (): Promise<void> => {
    const result = await api.images.open(id);
    if (!result.ok) fail(result.error);
  };

  const copy = async (): Promise<void> => {
    if (copying) return; // 复制进行中，忽略连点
    clearTimeout(timer.current);
    setCopied(false);
    setCopying(true);
    // 先让浏览器把“复制中”画出来，再发起 IPC，保证点击瞬间就有反馈
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    try {
      const result = await api.images.copyImage(id);
      if (!mounted.current) return; // 面板已关闭，复制已完成，无需再更新界面
      if (!result.ok) return fail(result.error);
      setCopied(result.kind === "path" ? "path" : "image");
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      if (mounted.current) {
        fail(t("detail.copyFailed", { message: err instanceof Error ? err.message : String(err) }));
      }
    } finally {
      if (mounted.current) setCopying(false);
    }
  };

  const more = async (): Promise<void> => {
    const result = await api.images.moreMenu(id);
    if (!result.ok) fail(result.error);
  };

  const copyTitle = copying
    ? t("detail.copying")
    : copied === "path"
      ? t("detail.copiedPath")
      : copied
        ? t("detail.copied")
        : t("detail.copyImage");

  return (
    <>
      <div className={styles.actions}>
        <button title={t("detail.openWithViewer")} onClick={() => void open()}>
          <Icon name="eye" />
        </button>
        <button
          title={copyTitle}
          className={copying ? styles.busy : undefined}
          aria-busy={copying}
          onClick={() => void copy()}
        >
          <Icon name={copied ? "check" : "copy"} />
        </button>
        <button
          title={favorite ? t("action.unfavorite") : t("action.favorite")}
          aria-pressed={!!favorite}
          onClick={() => void toggleFavorite(id)}
          style={favorite ? { color: "#e0556b" } : undefined}
        >
          <Icon name="heart" />
        </button>
        <button title={t("detail.more")} onClick={() => void more()}>
          <Icon name="more" />
        </button>
      </div>
      {error && (
        <p className={styles.hint} role="alert">
          {error}
        </p>
      )}
    </>
  );
}
