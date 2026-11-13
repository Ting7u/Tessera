import { useT } from "../../i18n";
import styles from "./Toast.module.scss";

export type ToastType = "info" | "success";

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface ToastProps {
  text: string;
  type?: ToastType;
  /** 提示上的操作按钮，例如“撤销” */
  action?: ToastAction | null;
  /** 点了 action 之后的回调（外面用来收起提示）；run 本身由外面决定何时调用 */
  onAction?: (action: ToastAction) => void;
  /** 传了就显示“取消下载”按钮（这是下载进度提示） */
  onCancelDownload?: () => void;
}

/**
 * 短提示（纯展示，状态在 store 的 toast slice，由 app/ToastHost 连接）：
 *   info（默认）：底部居中的深色条，例如“已保存 3 张到 D:\图片”
 *   success：顶部滑入的绿色泡泡，例如“收藏成功”
 */
export function Toast({ text, type = "info", action, onAction, onCancelDownload }: ToastProps) {
  const t = useT();
  return (
    <div className={`${styles.toast} ${type === "success" ? styles.success : ""}`} role="status">
      {type === "success" && <span className={styles.icon}>✓</span>}
      {text}
      {action && (
        <button type="button" className={styles.action} onClick={() => onAction?.(action)}>
          {action.label}
        </button>
      )}
      {onCancelDownload && (
        <button
          type="button"
          className={`${styles.action} ${styles.plain}`}
          onClick={onCancelDownload}
        >
          {t("toast.cancelDownload")}
        </button>
      )}
    </div>
  );
}
