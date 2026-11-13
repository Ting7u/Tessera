import type { DragEvent, MouseEvent } from "react";
import { Icon } from "@renderer/shared/ui";
import styles from "./Sidebar.module.scss";

export interface NavItemProps {
  icon: string;
  label: string;
  count?: number;
  active?: boolean;
  title?: string;
  /** 有图片正拖在上面（高亮用） */
  dropping?: boolean;
  onClick: () => void;
  onContextMenu?: (event: MouseEvent) => void;
  onDragOver?: (event: DragEvent) => void;
  onDragLeave?: (event: DragEvent) => void;
  onDrop?: (event: DragEvent) => void;
}

/** 侧边栏里的一个导航项（分类、文件夹、智能分类共用） */
export function NavItem({
  icon,
  label,
  count,
  active = false,
  title,
  dropping = false,
  onClick,
  onContextMenu,
  onDragOver,
  onDragLeave,
  onDrop,
}: NavItemProps) {
  return (
    <button
      className={`${styles.navItem} ${active ? styles.active : ""} ${dropping ? styles.dropTarget : ""}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      title={title}
    >
      <Icon name={icon} />
      <span className={styles.navLabel}>{label}</span>
      {count != null && <span className={styles.navCount}>{count}</span>}
    </button>
  );
}
