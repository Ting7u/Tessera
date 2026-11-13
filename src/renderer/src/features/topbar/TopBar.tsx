import type { ChangeEvent, CompositionEvent } from "react";
import { useT } from "@renderer/shared/i18n";
import { Icon } from "@renderer/shared/ui";
import { useAppStore } from "@renderer/store";
import { LayoutMenu } from "./LayoutMenu";
import { SortMenu } from "./SortMenu";
import styles from "./TopBar.module.scss";

// 顶部栏：标题、搜索、排序、图片布局、导入按钮
export function TopBar() {
  const t = useT();
  const title = useAppStore((s) => s.title);
  const query = useAppStore((s) => s.query);
  const setQuery = useAppStore((s) => s.setQuery);
  const openImport = useAppStore((s) => s.openImport);
  const total = useAppStore((s) => s.total);

  return (
    <header className={styles.topbar}>
      <div className={styles.heading}>
        <span className={styles.crumb}>
          {t("sidebar.libraryName")} <i>/</i> {title}
        </span>
        <h1 className={styles.title}>
          {title}
          <small>{t("gallery.count", { count: total })}</small>
        </h1>
      </div>
      <label className={styles.search}>
        <Icon name="search" size={16} />
        <input
          value={query}
          // 输入法合成期间（拼音阶段）isComposing 为 true，只更新文字不搜索；
          // 选定汉字时触发 compositionend，再按最终文字搜索
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            // change 事件的 nativeEvent 在运行时是 InputEvent，才有 isComposing；类型上是 Event，所以断言
            setQuery(event.target.value, (event.nativeEvent as InputEvent).isComposing)
          }
          onCompositionEnd={(event: CompositionEvent<HTMLInputElement>) =>
            setQuery(event.currentTarget.value)
          }
          placeholder={t("topbar.searchPlaceholder")}
        />
      </label>
      <SortMenu />
      <LayoutMenu />
      <button className={styles.importButton} onClick={openImport}>
        <Icon name="import" size={17} />
        {t("topbar.import")}
      </button>
    </header>
  );
}
