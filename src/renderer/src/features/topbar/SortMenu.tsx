import { useT } from "@renderer/shared/i18n";
import { SORT_KEYS, resolveSort, sortInfo } from "@renderer/shared/lib";
import { Icon, useMenu, type MenuItem } from "@renderer/shared/ui";
import { useAppStore } from "@renderer/store";
import type { SortSpec } from "@shared/types";
import topbar from "./TopBar.module.scss"; // 按钮样式沿用顶部栏的 .btn
import styles from "./SortMenu.module.scss";

// 顶部栏的排序按钮 + 下拉菜单：上半是“排序依据”，下半是“顺序”
export function SortMenu() {
  const t = useT();
  const active = useAppStore((s) => s.active);
  const sort = useAppStore((s) => s.sort);
  const setSort = useAppStore((s) => s.setSort);
  const { menu, openFrom, close, isOpen } = useMenu();

  const current = resolveSort(active, sort);
  const info = sortInfo(current.by);
  const byLabel = t(`sort.by.${current.by}`);
  const dirLabel = t(`sort.dir.${current.by}.${current.dir}`);

  const choose = (next: SortSpec): void => {
    if (next.by !== current.by || next.dir !== current.dir) setSort(next);
  };

  const items: MenuItem[] = [
    { type: "label", label: t("sort.group.by") },
    ...SORT_KEYS.map((k) => ({
      key: k.key,
      label: t(`sort.by.${k.key}`),
      checked: k.key === current.by,
      // 换排序依据时用它的默认顺序（文件名 A→Z，其余从新/从大到小）；点当前这一项则保持顺序不变
      onClick: () => choose({ by: k.key, dir: k.key === current.by ? current.dir : k.defaultDir }),
    })),
    { type: "divider" },
    { type: "label", label: t("sort.group.order") },
    ...info.dirs.map((dir) => ({
      key: `dir-${dir}`,
      label: t(`sort.dir.${current.by}.${dir}`),
      checked: dir === current.dir,
      onClick: () => choose({ by: current.by, dir }),
    })),
  ];

  return (
    <>
      <button
        className={topbar.btn}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={t("sort.buttonTitle", { by: byLabel, dir: dirLabel })}
        onClick={(event) => (isOpen ? close() : openFrom(event.currentTarget, items))}
      >
        <Icon name="sort" size={16} />
        {byLabel}
        <span className={styles.arrow}>{current.dir === "asc" ? "↑" : "↓"}</span>
      </button>
      {menu}
    </>
  );
}
