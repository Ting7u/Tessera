import { useEffect, useState, type ReactNode } from "react";

/** 要和 shared/styles/_mixins.scss 里的退出动画时长（0.18s）对应 */
export const EXIT_MS = 200;

export interface PresenceProps {
  show: boolean;
  children: ReactNode;
}

/**
 * 让弹窗关闭时也有动画：show 变成 false 后先保持挂载一小段时间，
 * 期间外层带 data-closing 标记，样式（_mixins.scss 的 modal-*-motion）据此播放退出动画，播完再真正卸载。
 * 用法：<Presence show={showX}><XDialog /></Presence>
 * 注意：弹窗必须渲染在 Presence 的 DOM 子树里（不要在弹窗里用 portal），否则 data-closing 选择器命中不了。
 */
export function Presence({ show, children }: PresenceProps) {
  const [mounted, setMounted] = useState(show);
  if (show && !mounted) setMounted(true); // 打开时立刻挂载，不等 effect，避免空一帧

  // 关闭时延迟卸载
  // 渲染期间，只要调用了 setXXX 本次渲染作废，useEffect挂载的函数将不会执行
  useEffect(() => {
    if (show) return undefined;
    const timer = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(timer); // 动画期间又重新打开：取消卸载
  }, [show]);

  if (!mounted) return null;
  // display: contents：这一层不参与布局，只用来携带 data-closing
  return (
    <div data-closing={show ? undefined : "true"} style={{ display: "contents" }}>
      {children}
    </div>
  );
}
