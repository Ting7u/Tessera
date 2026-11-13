import { useT } from "@renderer/shared/i18n";
import { Icon } from "@renderer/shared/ui";
import { useAppStore } from "@renderer/store";
import styles from "./SelectionBar.module.scss";

// 选中图片后出现的小巧操作条：悬浮在标题行右侧的空白处，不占布局、不遮挡标题文字
export function SelectionBar() {
  const t = useT();
  const count = useAppStore((s) => s.selected.length);
  const clearSelected = useAppStore((s) => s.clearSelected);
  const openDetail = useAppStore((s) => s.openDetail);
  const openMove = useAppStore((s) => s.openMove);
  const openTag = useAppStore((s) => s.openTag);

  // 锚点始终存在但高度为 0，操作条绝对定位在它里面
  return (
    <div className={styles.anchor}>
      {count > 0 && (
        <div className={styles.bar}>
          <b className={styles.count}>{t("selection.count", { count })}</b>
          <button className={styles.cancel} onClick={clearSelected}>
            {t("common.cancel")}
          </button>
          <span className={styles.divider} />
          <button
            className={styles.action}
            title={t("action.move")}
            aria-label={t("action.move")}
            onClick={() => openMove(useAppStore.getState().selected)}
          >
            <Icon name="move" size={15} />
          </button>
          <button
            className={styles.action}
            title={t("action.tag")}
            aria-label={t("action.tag")}
            onClick={() => openTag(useAppStore.getState().selected)}
          >
            <Icon name="tag" size={15} />
          </button>
          {/* 占位：删除功能还没接上，点了暂时没有反应 */}
          <button
            className={styles.action}
            title={t("action.delete")}
            aria-label={t("action.delete")}
          >
            <Icon name="trash" size={15} />
          </button>
          {/* 不能写 onClick={openDetail}，否则事件对象会被当成图片 id */}
          <button
            className={styles.action}
            title={t("action.info")}
            aria-label={t("action.info")}
            onClick={() => openDetail()}
          >
            <Icon name="info" size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
