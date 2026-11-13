import { useState, type ChangeEvent, type KeyboardEvent } from "react";
import { useT } from "../../i18n";
import { Dialog } from "../Dialog";
import styles from "./RenameDialog.module.scss";

/** 重命名的结果：成功（关闭弹窗）或带原因的失败（显示在弹窗里） */
export type RenameOutcome = { ok: true } | { ok: false; error?: string };

export interface RenameDialogProps {
  /** 弹窗标题，例如“重命名标签” */
  title: string;
  /** 原名字：显示在标题旁，也是输入框的初始值 */
  from: string;
  /** 名字为空时的提示 */
  emptyMessage: string;
  /** 执行重命名。抛出的错误会被接住并显示 */
  onSubmit: (to: string) => Promise<RenameOutcome>;
  onClose: () => void;
}

/**
 * 重命名弹窗：标签和智能分类共用，各自传标题和提交函数。
 * 外面要给它 key={原名字或 id}：关闭动画期间又对另一项点“重命名”时，输入框内容要跟着换。
 */
export function RenameDialog({ title, from, emptyMessage, onSubmit, onClose }: RenameDialogProps) {
  const t = useT();
  const [value, setValue] = useState(from);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(""); // 弹窗盖在提示条上面，失败原因直接显示在弹窗里

  const submit = async (): Promise<void> => {
    if (busy) return;
    const to = value.trim();
    if (!to) {
      setError(emptyMessage);
      return;
    }
    if (to === from) {
      onClose();
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await onSubmit(to);
      if (res.ok) onClose();
      else if (res.error) setError(res.error); // 没有 error：例如在合并确认框里点了取消，保留弹窗
    } catch (err) {
      console.error(err);
      setError(t("rename.failed", { message: err instanceof Error ? err.message : String(err) }));
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.nativeEvent.isComposing) return; // 拼音还没选字时的回车不算确认
    if (event.key === "Enter") void submit();
  };

  return (
    <Dialog onClose={onClose} locked={busy} label={title}>
      <header className={styles.header}>
        <h3>{title}</h3>
        <span>{from}</span>
      </header>

      <div className={styles.label}>{t("rename.newName")}</div>
      <input
        autoFocus
        className={styles.input}
        value={value}
        maxLength={30}
        onFocus={(event) => event.target.select()}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
      />

      {error && <p className={styles.error}>{error}</p>}

      <footer className={styles.footer}>
        <button className={styles.cancel} disabled={busy} onClick={onClose}>
          {t("common.cancel")}
        </button>
        <button className={styles.done} disabled={busy} onClick={() => void submit()}>
          {t("common.ok")}
        </button>
      </footer>
    </Dialog>
  );
}
