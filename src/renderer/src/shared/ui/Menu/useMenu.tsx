import { useCallback, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { Menu, type MenuItem } from "./Menu";

interface MenuState {
  items: MenuItem[];
  x?: number;
  y?: number;
  anchorEl?: HTMLElement;
  align?: "right" | "left";
}

export interface UseMenuResult {
  /** 放进自己的 JSX 里（位置随便放，它会自己渲染到 body 上）；菜单关闭时为 null */
  menu: ReactNode;
  /** 右键：event 是 onContextMenu 收到的事件。会顺便阻止系统自带菜单和事件继续冒泡 */
  openAt: (event: ReactMouseEvent, items: MenuItem[]) => void;
  /** 下拉：anchorEl 是按钮的 DOM 元素（event.currentTarget） */
  openFrom: (anchorEl: HTMLElement, items: MenuItem[], align?: "right" | "left") => void;
  /** 菜单打开期间换一份菜单项（用 keepOpen 的单选项要靠它让对勾跟着变）；菜单没打开时什么都不做 */
  update: (items: MenuItem[]) => void;
  close: () => void;
  isOpen: boolean;
}

/**
 * 菜单的状态管理：谁要弹菜单，谁调用一次这个 hook，再把返回的 menu 放进自己的 JSX 里。
 *
 * 右键菜单：<div onContextMenu={(event) => openAt(event, items)}>
 * 下拉菜单：<button onClick={(event) => (isOpen ? close() : openFrom(event.currentTarget, items))}>
 */
export function useMenu(): UseMenuResult {
  const [state, setState] = useState<MenuState | null>(null); // null = 关闭

  const close = useCallback(() => setState(null), []);

  const openAt = useCallback((event: ReactMouseEvent, items: MenuItem[]) => {
    event.preventDefault();
    event.stopPropagation();
    setState({ items, x: event.clientX, y: event.clientY });
  }, []);

  const openFrom = useCallback(
    (anchorEl: HTMLElement, items: MenuItem[], align?: "right" | "left") => {
      setState({ items, anchorEl, align });
    },
    [],
  );

  const update = useCallback((items: MenuItem[]) => {
    setState((prev) => (prev ? { ...prev, items } : prev));
  }, []);

  const menu = state ? <Menu {...state} onClose={close} /> : null;

  return { menu, openAt, openFrom, update, close, isOpen: state !== null };
}
