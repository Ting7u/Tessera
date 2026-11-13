import { useEffect } from "react";
import { useT } from "@renderer/shared/i18n";
import { useAppStore } from "@renderer/store";
import styles from "./ImportProgress.module.scss";

// 右下角的导入进度浮层；完成后 4 秒自动消失
export function ImportProgress() {
  const t = useT();
  const progress = useAppStore((s) => s.progress);
  const dismiss = useAppStore((s) => s.dismissProgress);

  useEffect(() => {
    if (!progress?.finished) return undefined;
    const timer = setTimeout(dismiss, 4000);
    return () => clearTimeout(timer);
  }, [progress, dismiss]);

  if (!progress) return null;

  const { total, done, added, skipped, failed, current, finished } = progress;
  const percent = total ? Math.round((done / total) * 100) : 100;

  let text: string;
  if (!finished) text = t("importProgress.running", { done, total });
  else if (!total) text = t("importProgress.none");
  else {
    const details = [t("importProgress.added", { count: added })];
    if (skipped) details.push(t("importProgress.skipped", { count: skipped }));
    if (failed) details.push(t("importProgress.failed", { count: failed }));
    text = t("importProgress.done", { details: details.join(t("common.comma")) });
  }

  return (
    <div className={styles.progress} role="status">
      <div className={styles.head}>
        <b>{text}</b>
        <button aria-label={t("common.close")} onClick={dismiss}>
          ×
        </button>
      </div>
      {!finished && <span className={styles.file}>{current}</span>}
      <div className={styles.bar}>
        <i style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
