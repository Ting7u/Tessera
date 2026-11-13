import { useT } from "@renderer/shared/i18n";
import { Icon } from "@renderer/shared/ui";
import { useAppStore } from "@renderer/store";
import styles from "./DuplicateNotice.module.scss";

// 占位：和旧版一致，数量写死为 3。真实数量应取 sidebar.duplicate，这里保持行为不变
const PLACEHOLDER_COUNT = 3;

// “相似图片”页面顶部的提示条
export function DuplicateNotice() {
  const t = useT(); // hook 必须写在下面的 return null 之前
  const active = useAppStore((s) => s.active);
  if (active !== "duplicate") return null;

  return (
    <div className={styles.notice}>
      <Icon name="sparkle" />
      <span>
        <b>{t("duplicate.found", { count: PLACEHOLDER_COUNT })}</b> {t("duplicate.desc")}
      </span>
      <button>{t("duplicate.help")}</button>
    </div>
  );
}
