import { memo, type DragEvent, type MouseEvent } from "react";
import { useT } from "@renderer/shared/i18n";
import { DRAG_IMAGES, type ViewItem } from "@renderer/shared/lib";
import { Icon, useMenu, type MenuItem } from "@renderer/shared/ui";
import { useAppStore } from "@renderer/store";
import styles from "./Tile.module.scss";

export interface TileProps {
  item: ViewItem;
}

// 单张图片卡片：平时点击打开详情；右上角 “⋯” 菜单里选了“选择”之后进入多选状态——
// 这时每张卡片左上角出现选择圆圈，点击卡片是选中/取消选中，不再打开详情；全部取消选择后恢复平时的行为
function TileView({ item }: TileProps) {
  const t = useT();
  // 只订阅"自己是否被选中"，选中其他图片时不会重渲染这张卡片
  const selected = useAppStore((s) => s.selected.includes(item.id));
  const selecting = useAppStore((s) => s.selected.length > 0); // 是否处在多选状态（至少选了一张）
  const toggleSelected = useAppStore((s) => s.toggleSelected);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const openDetail = useAppStore((s) => s.openDetail);
  const openMove = useAppStore((s) => s.openMove);
  const openTag = useAppStore((s) => s.openTag);

  // 菜单的打开/关闭、定位、点外面关闭等都交给通用的 Menu
  const { menu, openFrom, close, isOpen } = useMenu();

  // 这张图已被选中就对所有已选图片操作，否则只对这一张（和资源管理器的习惯一致）
  const targetIds = (): number[] => {
    const { selected: ids } = useAppStore.getState();
    return ids.includes(item.id) ? ids : [item.id];
  };

  // 拖动卡片：拖到侧边栏的文件夹上就是移动
  const onDragStart = (event: DragEvent): void => {
    event.dataTransfer.setData(DRAG_IMAGES, JSON.stringify(targetIds()));
    event.dataTransfer.effectAllowed = "move";
  };

  const menuItems: MenuItem[] = [
    {
      key: "select",
      icon: "check",
      label: selected ? t("action.deselect") : t("action.select"),
      onClick: () => toggleSelected(item.id),
    },
    {
      key: "favorite",
      icon: "heart",
      label: item.favorite ? t("action.unfavorite") : t("action.favorite"),
      onClick: () => void toggleFavorite(item.id),
    },
    { key: "move", icon: "move", label: t("action.move"), onClick: () => openMove(targetIds()) },
    { key: "tag", icon: "tag", label: t("action.tag"), onClick: () => openTag(targetIds()) },
    // 占位：删除功能还没接上，点了暂时没有反应
    { key: "delete", icon: "trash", label: t("action.delete"), danger: true },
    { key: "info", icon: "info", label: t("action.info"), onClick: () => openDetail(item.id) },
  ];

  // “⋯” 按钮：再点一次关闭菜单。stopPropagation 是为了不触发卡片的“打开详情”
  const toggleMenu = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    if (isOpen) close();
    else openFrom(event.currentTarget, menuItems);
  };

  return (
    <figure
      className={`${styles.tile} ${selected ? styles.selected : ""} ${selecting ? styles.selecting : ""}`}
      style={{
        aspectRatio: item.ratio,
        // 渐变作为占位底色：缩略图加载前、解码失败、模拟数据时都显示它
        background: `linear-gradient(145deg, hsl(${item.hue} 35% 49%), hsl(${(item.hue + 42) % 360} 38% 18%))`,
      }}
      onClick={() => (selecting ? toggleSelected(item.id) : openDetail(item.id))}
      draggable
      onDragStart={onDragStart}
    >
      {/* 用 <img> 而不是 background-image：lazy 让屏幕外的缩略图不发起加载，async 解码不阻塞滚动 */}
      {item.thumb && (
        <img
          className={styles.thumb}
          src={item.thumb}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      )}
      <span className={styles.light} />

      {/* 多选状态下才显示：空心圆 = 未选，实心圆 + 对勾 = 已选 */}
      {selecting && (
        <span className={styles.check} aria-hidden="true">
          {selected && <Icon name="check" size={13} />}
        </span>
      )}

      {item.duplicate && (
        <span className={styles.duplicateMark}>
          <Icon name="sparkle" size={13} />
          {t("tile.similar")}
        </span>
      )}

      <button
        className={`${styles.more} ${isOpen ? styles.active : ""}`}
        aria-label={t("tile.moreActions", { name: item.name })}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={toggleMenu}
      >
        <Icon name="more" size={16} />
      </button>

      <figcaption className={styles.caption}>
        <strong>{item.name}</strong>
        <span>
          {item.date} · {item.size}
        </span>
      </figcaption>

      {/* 菜单本身渲染在 body 上（卡片有 overflow: hidden，放在里面会被裁掉），这里只是挂载点 */}
      {menu}
    </figure>
  );
}

// 列表刷新时 item 会是新对象，所以按内容比较；没变化的卡片不重渲染
// 注意 favorite 也要比较，否则收藏后菜单里的文字不会更新
export const Tile = memo(
  TileView,
  (a, b) =>
    a.item.id === b.item.id &&
    a.item.thumb === b.item.thumb &&
    a.item.ratio === b.item.ratio &&
    a.item.duplicate === b.item.duplicate &&
    a.item.favorite === b.item.favorite,
);
