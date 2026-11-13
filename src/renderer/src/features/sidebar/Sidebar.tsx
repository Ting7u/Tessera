import { useState, type DragEvent } from "react";
import { api } from "@renderer/shared/api";
import { useT } from "@renderer/shared/i18n";
import { DRAG_IMAGES } from "@renderer/shared/lib";
import { Icon } from "@renderer/shared/ui";
import { useAppStore } from "@renderer/store";
import type { SidebarFolder } from "@shared/types";
import { NavItem } from "./NavItem";
import { TagCloud } from "./TagCloud";
import styles from "./Sidebar.module.scss";

// 内置分类：名字在 locales 里是 category.<id>，数量来自 sidebar 数据
const CATEGORIES = [
  { id: "all", icon: "grid" },
  { id: "recent", icon: "clock" },
  { id: "duplicate", icon: "sparkle" },
  { id: "favorites", icon: "heart" },
] as const;

const THEMES = [
  { key: "dark", icon: "moon", textKey: "sidebar.theme.dark" },
  { key: "light", icon: "sun", textKey: "sidebar.theme.light" },
] as const;

// 只接受应用内部拖动（DRAG_IMAGES）；网页图片的拖放不在这里处理
const isImageDrag = (event: DragEvent): boolean =>
  Array.from(event.dataTransfer.types).includes(DRAG_IMAGES);

export function Sidebar() {
  const t = useT();
  const active = useAppStore((s) => s.active);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const sidebar = useAppStore((s) => s.sidebar);
  const selectCategory = useAppStore((s) => s.selectCategory);
  const openImport = useAppStore((s) => s.openImport);
  const openSettings = useAppStore((s) => s.openSettings);
  const openSmart = useAppStore((s) => s.openSmart);
  const moveImages = useAppStore((s) => s.moveImages);
  const [dropKey, setDropKey] = useState<string | null>(null); // 正有图片拖在哪个文件夹上（高亮用）

  // 把图库里的图片拖到文件夹上 = 移动到这个文件夹
  const dropHandlers = (f: SidebarFolder) => ({
    onDragOver: (event: DragEvent) => {
      if (!isImageDrag(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDropKey(f.key);
    },
    onDragLeave: (event: DragEvent) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        setDropKey((k) => (k === f.key ? null : k));
      }
    },
    onDrop: (event: DragEvent) => {
      if (!isImageDrag(event)) return;
      event.preventDefault();
      event.stopPropagation();
      setDropKey(null);
      let ids: unknown;
      try {
        ids = JSON.parse(event.dataTransfer.getData(DRAG_IMAGES));
      } catch {
        return; // 数据不对就忽略
      }
      if (Array.isArray(ids) && ids.length)
        void moveImages(ids as number[], f.path);
    },
  });

  const counts: Record<(typeof CATEGORIES)[number]["id"], number> = {
    all: sidebar.total,
    recent: sidebar.recent,
    duplicate: sidebar.duplicate,
    favorites: sidebar.favorites,
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.librarySummary}>
        <span className={styles.librarySymbol}>
          <Icon name="image" size={17} />
        </span>
        <span>
          <b>{t("sidebar.libraryName")}</b>
          <small>{t("sidebar.librarySub")}</small>
        </span>
      </div>
      {/* 只有这一块会滚动：顶部的“我的图库”和底部的设置/主题切换始终固定，不会和标题栏重叠 */}
      <div className={styles.scroll}>
        <div className={styles.groupTitle}>{t("sidebar.group.library")}</div>
        {CATEGORIES.map((c) => (
          <NavItem
            key={c.id}
            icon={c.icon}
            label={t(`category.${c.id}`)}
            count={counts[c.id]}
            active={active === c.id}
            onClick={() => selectCategory(c.id)}
          />
        ))}

        <div className={`${styles.groupTitle} ${styles.spaced}`}>
          {t("sidebar.group.folders")}
          <button
            className={styles.iconBtn}
            title={t("sidebar.importFolder")}
            onClick={openImport}
          >
            <Icon name="plus" size={15} />
          </button>
        </div>
        {sidebar.folders.map((f) => (
          <NavItem
            key={f.key}
            icon="folder"
            label={f.label}
            title={t("sidebar.folderHint", { path: f.path })}
            count={f.count}
            active={active === f.key}
            dropping={dropKey === f.key}
            onClick={() => selectCategory(f.key)}
            onContextMenu={(event) => {
              event.preventDefault();
              void api.folders.menu(f.path);
            }}
            {...dropHandlers(f)}
          />
        ))}

        <TagCloud />

        {sidebar.smart.length > 0 && (
          <div className={`${styles.groupTitle} ${styles.spaced}`}>
            {t("sidebar.group.smart")}
          </div>
        )}
        {sidebar.smart.map((s) => (
          <NavItem
            key={s.key}
            icon="folderOpen"
            label={s.name}
            count={s.count}
            active={active === s.key}
            title={t("sidebar.smartHint", { name: s.name })}
            onClick={() => selectCategory(s.key)}
            onContextMenu={(event) => {
              event.preventDefault();
              void api.smart.menu(s.id, s.name);
            }}
          />
        ))}

        <button
          className={`${styles.navItem} ${styles.add}`}
          onClick={openSmart}
        >
          <Icon name="plus" />
          <span className={styles.navLabel}>{t("smart.new")}</span>
        </button>
      </div>

      <div className={styles.footer}>
        <button className={styles.librarySettings} onClick={openSettings}>
          <Icon name="settings" size={17} />
          {t("sidebar.settings")}
        </button>

        <div
          className={styles.segmented}
          role="group"
          aria-label={t("sidebar.theme.aria")}
        >
          {THEMES.map(({ key, icon, textKey }) => (
            <button
              key={key}
              className={theme === key ? styles.on : ""}
              onClick={() => setTheme(key)}
            >
              <Icon name={icon} size={15} />
              {t(textKey)}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
