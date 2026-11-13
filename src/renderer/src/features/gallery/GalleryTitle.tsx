import { useT } from "@renderer/shared/i18n";
import { resolveSort } from "@renderer/shared/lib";
import { useAppStore } from "@renderer/store";
import styles from "./GalleryTitle.module.scss";

export function GalleryTitle() {
  const t = useT();
  const active = useAppStore((s) => s.active);
  const total = useAppStore((s) => s.total);
  const sort = useAppStore((s) => s.sort);

  // 例如“按拍摄时间排序 · 最新在前”，跟着顶部栏的排序方式变化
  const current = resolveSort(active, sort);
  const sortText = t("sort.buttonTitle", {
    by: t(`sort.by.${current.by}`),
    dir: t(`sort.dir.${current.by}.${current.dir}`),
  });

  return (
    <div className={styles.title}>
      <span>
        {active === "duplicate" ? t("gallery.title.duplicate") : t("gallery.title.default")}
      </span>
      <small>
        {active === "all" ? sortText : t("gallery.summary", { count: total, sort: sortText })}
      </small>
    </div>
  );
}
