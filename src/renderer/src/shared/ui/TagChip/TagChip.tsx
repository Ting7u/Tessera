import type { MouseEvent, ReactNode } from "react";
import { tagStyle } from "../../lib/tagColor";
import styles from "./TagChip.module.scss";

export interface TagChipProps {
  name: string;
  /** 数量角标（侧边栏的张数，或弹窗里的“有这个标签的张数/总张数”） */
  count?: ReactNode;
  /** 选中（侧边栏当前查看的标签） */
  active?: boolean;
  title?: string;
  /** 传了 onClick 渲染成 <button>；不传渲染成 <span>（只展示，例如弹窗里的已有标签） */
  onClick?: () => void;
  onContextMenu?: (event: MouseEvent) => void;
  /** 额外内容，放在数量之后（例如移除用的 ×） */
  children?: ReactNode;
}

/** 标签小圆角块：颜色由标签名算出（同名同色） */
export function TagChip({
  name,
  count,
  active = false,
  title,
  onClick,
  onContextMenu,
  children,
}: TagChipProps) {
  const body = (
    <>
      <i className={styles.dot} />
      <span className={styles.name}>{name}</span>
      {count != null && <span className={styles.count}>{count}</span>}
      {children}
    </>
  );
  const className = `${styles.chip} ${active ? styles.active : ""}`;

  if (!onClick) {
    return (
      <span className={`${className} ${styles.static}`} style={tagStyle(name)} title={title}>
        {body}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={className}
      style={tagStyle(name)}
      title={title}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {body}
    </button>
  );
}
