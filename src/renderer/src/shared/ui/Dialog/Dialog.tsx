import type { ReactNode } from "react";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import styles from "./Dialog.module.scss";

export interface DialogProps {
  onClose: () => void;
  /** 忙碌中：Esc 和点遮罩都不能关闭（避免操作进行到一半被关掉） */
  locked?: boolean;
  /** 没有可见标题时用 aria-label；有标题元素时用 labelledBy 指向它的 id */
  label?: string;
  labelledBy?: string;
  /** 面板的样式类名；不传用默认外观 */
  className?: string;
  /** 遮罩的样式类名；不传用默认外观 */
  backdropClassName?: string;
  children: ReactNode;
}

/**
 * 弹窗外壳：遮罩 + 面板 + 点遮罩关闭 + Esc 关闭 + 无障碍属性。
 * 显示与否由外面的 <Presence show={...}> 控制（关闭时先播完退出动画再卸载）。
 * 不用 portal：必须留在 Presence 的 DOM 子树里，退出动画才能生效。
 */
export function Dialog({
  onClose,
  locked = false,
  label,
  labelledBy,
  className,
  backdropClassName,
  children,
}: DialogProps) {
  useEscapeKey(onClose, !locked);

  return (
    <div
      className={backdropClassName ?? styles.backdrop}
      role="presentation"
      // 只有按在遮罩本身上才算“点外面”，按在面板里再拖出来不会误关
      onMouseDown={(event) => event.target === event.currentTarget && !locked && onClose()}
    >
      <section
        className={className ?? styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-labelledby={labelledBy}
      >
        {children}
      </section>
    </div>
  );
}
