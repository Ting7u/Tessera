import { useState } from "react";
import { api } from "@renderer/shared/api";
import { useT } from "@renderer/shared/i18n";
import { TagChip } from "@renderer/shared/ui";
import { useAppStore } from "@renderer/store";
import sidebarStyles from "./Sidebar.module.scss";
import styles from "./Tags.module.scss";

const TAG_LIMIT = 12; // 标签默认最多显示多少个，其余点“显示全部”展开

// 侧边栏的“标签”区块：标签云 + 展开/收起
export function TagCloud() {
  const t = useT();
  const active = useAppStore((s) => s.active);
  const tags = useAppStore((s) => s.sidebar.tags);
  const selectCategory = useAppStore((s) => s.selectCategory);
  const [expanded, setExpanded] = useState(false);

  // 折叠时只显示前 TAG_LIMIT 个；正在查看的标签即使排在后面也要显示出来
  const shown = expanded ? tags : tags.filter((tag, i) => i < TAG_LIMIT || tag.key === active);

  return (
    <>
      <div className={`${sidebarStyles.groupTitle} ${sidebarStyles.spaced}`}>
        {t("sidebar.group.tags")}
        {tags.length > 0 && <span className={styles.total}>{tags.length}</span>}
      </div>
      {tags.length === 0 ? (
        <p className={styles.hint}>{t("sidebar.tagsEmpty")}</p>
      ) : (
        <>
          <div className={styles.cloud}>
            {shown.map((tag) => (
              <TagChip
                key={tag.key}
                name={tag.name}
                count={tag.count}
                active={active === tag.key}
                title={t("sidebar.tagHint", { name: tag.name, count: tag.count })}
                onClick={() => selectCategory(tag.key)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  void api.tags.menu(tag.name);
                }}
              />
            ))}
          </div>
          {tags.length > TAG_LIMIT && (
            <button className={styles.more} onClick={() => setExpanded((v) => !v)}>
              {expanded
                ? t("sidebar.tagsCollapse")
                : t("sidebar.tagsShowAll", { count: tags.length })}
            </button>
          )}
        </>
      )}
    </>
  );
}
