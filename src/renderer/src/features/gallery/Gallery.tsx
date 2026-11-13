import { useRef } from "react";
import { useT } from "@renderer/shared/i18n";
import { Icon } from "@renderer/shared/ui";
import { useAppStore } from "@renderer/store";
import { LoadMoreSentinel } from "./LoadMoreSentinel";
import { Tile } from "./Tile";
import { VirtualGrid } from "./VirtualGrid";
import styles from "./Gallery.module.scss";

// 图片区域：布局方式（瀑布流 / 网格 / 对齐行）由顶部栏的“图片布局”菜单决定
export function Gallery() {
  const t = useT();
  const items = useAppStore((s) => s.items);
  const libraryTotal = useAppStore((s) => s.libraryTotal);
  const layout = useAppStore((s) => s.layout);
  const loadMore = useAppStore((s) => s.loadMore);
  const openImport = useAppStore((s) => s.openImport);
  const scrollRef = useRef<HTMLDivElement>(null); // 滚动容器：虚拟列表要靠它知道滚到哪了

  // 图库还是空的：引导用户导入
  if (libraryTotal === 0) {
    return (
      <div className={styles.scroll}>
        <div className={styles.empty}>
          <Icon name="import" size={28} />
          <b>{t("gallery.empty.title")}</b>
          <span>{t("gallery.empty.hint")}</span>
          <button onClick={openImport}>{t("gallery.empty.import")}</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.scroll} ref={scrollRef}>
      <VirtualGrid
        items={items}
        scrollRef={scrollRef}
        mode={layout.mode}
        size={layout.size}
        renderItem={(item) => <Tile item={item} />}
      />
      <LoadMoreSentinel onVisible={() => void loadMore()} itemCount={items.length} />
    </div>
  );
}
