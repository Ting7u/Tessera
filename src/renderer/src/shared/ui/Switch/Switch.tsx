import type { CSSProperties, ReactNode } from "react";
import styles from "./Switch.module.scss";

export interface SwitchProps {
  /** 是否开启（受控） */
  checked?: boolean;
  /** 切换回调，参数是新的状态 */
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  /** 尺寸，md 与最初的开关一致 */
  size?: "sm" | "md" | "lg";
  /** 开启时的轨道颜色，默认 var(--accent) */
  color?: string;
  /** 关闭时的轨道颜色，默认 var(--line) */
  offColor?: string;
  /** 滑块颜色，默认白色 */
  thumbColor?: string;
  /** 滑块内图标颜色，默认跟随开启颜色 */
  iconColor?: string;
  checkedIcon?: ReactNode;
  uncheckedIcon?: ReactNode;
  /** 动画：平滑 / 回弹 / 无 */
  animation?: "smooth" | "spring" | "none";
  /** 标题文字（传了就会渲染成 <label>，点文字也能切换） */
  label?: ReactNode;
  /** 标题下方的说明小字 */
  description?: ReactNode;
  labelPosition?: "right" | "left";
  className?: string;
  /** 额外样式，也可以用来覆盖 --sw-w / --sw-h / --sw-pad */
  style?: CSSProperties;
  "aria-label"?: string;
}

/** 通用开关。没有 label 时只渲染轨道按钮；有 label 时整体是一个可点的 <label> */
export function Switch({
  checked = false,
  onChange,
  disabled = false,
  size = "md",
  color,
  offColor,
  thumbColor,
  iconColor,
  checkedIcon,
  uncheckedIcon,
  animation = "smooth",
  label,
  description,
  labelPosition = "right",
  className = "",
  style,
  "aria-label": ariaLabel,
}: SwitchProps) {
  const toggle = (): void => {
    if (!disabled) onChange?.(!checked);
  };

  // 颜色通过 CSS 变量传给样式；没传就用 scss 里的默认值
  const vars: Record<string, string | number | undefined> = { ...style };
  if (color) vars["--sw-on"] = color;
  if (offColor) vars["--sw-off"] = offColor;
  if (thumbColor) vars["--sw-thumb"] = thumbColor;
  if (iconColor) vars["--sw-icon"] = iconColor;
  // CSS 自定义属性不在 CSSProperties 的类型里，这里只是往 style 里塞变量，运行时是安全的
  const varStyle = vars as CSSProperties;

  const rootClass = [
    styles[`size-${size}`],
    styles[`anim-${animation}`],
    disabled ? styles.disabled : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const icon = checked ? checkedIcon : uncheckedIcon;

  const track = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={toggle}
      // 没有文字时，按钮本身就是最外层，样式和类名直接挂在它身上
      className={`${styles.track} ${checked ? styles.on : ""} ${label ? "" : rootClass}`}
      style={label ? undefined : varStyle}
    >
      <span className={styles.thumb}>
        {icon ? <span className={styles.icon}>{icon}</span> : null}
      </span>
    </button>
  );

  if (!label) return track;

  return (
    <label
      className={`${styles.root} ${labelPosition === "left" ? styles.reverse : ""} ${rootClass}`}
      style={varStyle}
    >
      {track}
      <span className={styles.text}>
        <b>{label}</b>
        {description ? <small>{description}</small> : null}
      </span>
    </label>
  );
}
