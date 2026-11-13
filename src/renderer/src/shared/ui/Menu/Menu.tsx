import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../Icon";
import styles from "./Menu.module.scss";

const EDGE = 8; // 菜单离窗口边缘至少留这么多空隙
const GAP = 6; // 下拉模式下，菜单和触发按钮之间的间距

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(value, max));

/** 普通项 */
export interface MenuActionItem {
  type?: "item";
  key?: string;
  label: string;
  /** 图标名（Icon 组件里的名字） */
  icon?: string;
  onClick?: () => void;
  /** 危险操作，红色 */
  danger?: boolean;
  /** 禁用，灰色且点不了 */
  disabled?: boolean;
  /** 传了（true/false）就当作单选项：选中的显示对勾和强调色 */
  checked?: boolean;
  /** 点了之后不关菜单（默认点完就关） */
  keepOpen?: boolean;
}
/** 分隔线 */
export interface MenuDividerItem {
  type: "divider";
  key?: string;
}
/** 小号分组标题 */
export interface MenuLabelItem {
  type: "label";
  key?: string;
  label: string;
}
export type MenuItem = MenuActionItem | MenuDividerItem | MenuLabelItem;

export interface MenuProps {
  items: MenuItem[];
  /** 右键菜单的位置（视口坐标） */
  x?: number;
  y?: number;
  /** 下拉菜单的触发元素；点它不会被当成“点到菜单外”，方便它自己切换开关 */
  anchorEl?: HTMLElement | null;
  /** 下拉菜单和按钮的哪一侧对齐，默认右对齐 */
  align?: "right" | "left";
  /** 需要关闭时调用（点外面、Esc、滚动、点选项……） */
  onClose: () => void;
}

/**
 * 通用菜单（右键菜单 / 下拉菜单共用）。一般不直接用它，用 useMenu() 更省事。
 * 两种定位方式二选一：传 x、y（右键，出现在鼠标旁）或 anchorEl（下拉，出现在按钮下方，放不下自动翻到上方）。
 */
export function Menu({
  items,
  x = 0,
  y = 0,
  anchorEl = null,
  align = "right",
  onClose,
}: MenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null); // 量完菜单大小之后才有值，之前先藏着

  useEffect(() => {
    closeRef.current = onClose;
  });

  // 有任何一项带图标或勾选，就给所有普通项留出图标列，文字才对得齐
  const hasIconColumn = items.some(
    (item) =>
      item.type !== "divider" && item.type !== "label" && (item.icon || item.checked !== undefined),
  );

  // 先渲染出来量实际大小，再决定位置；在浏览器绘制之前完成，所以不会闪
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left: number;
    let top: number;
    if (anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      left = align === "left" ? rect.left : rect.right - width;
      top = rect.bottom + GAP;
      if (top + height > vh - EDGE) top = rect.top - GAP - height; // 下方放不下，翻到上方
    } else {
      left = x;
      top = y;
      if (left + width > vw - EDGE) left = x - width; // 右边放不下，翻到鼠标左边
      if (top + height > vh - EDGE) top = y - height; // 下边放不下，翻到鼠标上方
    }

    left = clamp(left, EDGE, Math.max(EDGE, vw - width - EDGE));
    top = clamp(top, EDGE, Math.max(EDGE, vh - height - EDGE));
    setPos((prev) => (prev && prev.left === left && prev.top === top ? prev : { left, top }));
  }, [anchorEl, align, x, y, items]);

  // 菜单打开期间：点外面、Esc、滚动、改变窗口大小、窗口失焦都关闭；↑ ↓ Home End 在选项间移动
  useEffect(() => {
    const el = menuRef.current;
    const close = (): void => closeRef.current();

    const onDown = (event: MouseEvent): void => {
      const target = event.target as Node | null;
      // 点的是菜单自己或触发按钮就不处理（触发按钮自己会切换开关）
      if (el?.contains(target) || anchorEl?.contains(target)) return;
      close();
    };

    const onKey = (event: KeyboardEvent): void => {
      const { key } = event;
      if (key === "Escape") {
        // 只关菜单：拦住这次按键，不让它继续传给“按 Esc 关闭详情”之类的监听
        event.stopPropagation();
        close();
        return;
      }
      if (key === "ArrowLeft" || key === "ArrowRight") {
        // 菜单没有子菜单，左右键什么都不做；同时拦住，免得详情页趁机切换图片
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (key === "ArrowDown" || key === "ArrowUp" || key === "Home" || key === "End") {
        event.preventDefault();
        event.stopPropagation();
        const list = Array.from(
          el?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [],
        );
        if (!list.length) return;
        const current = list.indexOf(document.activeElement as HTMLButtonElement);
        let next: number;
        if (key === "Home") next = 0;
        else if (key === "End") next = list.length - 1;
        else if (key === "ArrowDown") next = current < 0 ? 0 : (current + 1) % list.length;
        else next = current < 0 ? list.length - 1 : (current - 1 + list.length) % list.length;
        list[next].focus();
      }
    };

    // 菜单自己内部滚动（选项很多时）不算
    const onScroll = (event: Event): void => {
      if (!el?.contains(event.target as Node)) close();
    };

    document.addEventListener("mousedown", onDown, true);
    window.addEventListener("keydown", onKey, true); // 捕获阶段：比其他组件的按键监听先执行
    window.addEventListener("scroll", onScroll, true); // 画廊在容器内滚动，所以要用捕获
    window.addEventListener("resize", close);
    window.addEventListener("blur", close);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("blur", close);
    };
  }, [anchorEl]);

  return createPortal(
    <div
      ref={menuRef}
      className={styles.menu}
      role="menu"
      style={pos ?? { top: 0, left: 0, visibility: "hidden" }}
      // 菜单渲染在 body 上，但 React 事件仍会沿组件树冒泡到外层（比如卡片的“打开详情”、
      // 侧边栏条目的右键处理），所以这两个必须拦住，否则点菜单会触发外层的操作
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {items.map((item, index) => {
        if (item.type === "divider") {
          return (
            <div key={item.key ?? `divider-${index}`} className={styles.divider} role="separator" />
          );
        }
        if (item.type === "label") {
          return (
            <div key={item.key ?? `label-${index}`} className={styles.label}>
              {item.label}
            </div>
          );
        }

        const isRadio = item.checked !== undefined;
        const classes = [styles.item, item.danger && styles.danger, item.checked && styles.checked]
          .filter(Boolean)
          .join(" ");

        return (
          <button
            key={item.key ?? item.label}
            type="button"
            className={classes}
            role={isRadio ? "menuitemradio" : "menuitem"}
            aria-checked={isRadio ? !!item.checked : undefined}
            disabled={item.disabled}
            onClick={() => {
              if (!item.keepOpen) closeRef.current();
              item.onClick?.();
            }}
          >
            {hasIconColumn && (
              <span className={styles.icon}>
                {isRadio
                  ? item.checked && <Icon name="check" size={14} />
                  : item.icon && <Icon name={item.icon} size={15} />}
              </span>
            )}
            {item.label}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
