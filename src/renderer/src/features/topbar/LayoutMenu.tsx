import { useEffect } from "react";
import { useT } from "@renderer/shared/i18n";
import { LAYOUTS, SIZES } from "@renderer/shared/lib";
import { Icon, useMenu, type MenuItem } from "@renderer/shared/ui";
import { useAppStore } from "@renderer/store";
import topbar from "./TopBar.module.scss"; // 按钮样式沿用顶部栏的 .iconOnly

// 顶部栏的“图片布局”按钮 + 下拉菜单：上半选布局方式，下半选图片大小
export function LayoutMenu() {
  const t = useT();
  const layout = useAppStore((s) => s.layout);
  const setLayout = useAppStore((s) => s.setLayout);
  const { menu, openFrom, update, close, isOpen } = useMenu();

  // keepOpen：布局和大小经常要一起调，调完点外面就行
  const items: MenuItem[] = [
    { type: "label", label: t("layout.group.mode") },
    ...LAYOUTS.map((l) => ({
      key: `mode-${l.key}`,
      label: t(`layout.mode.${l.key}`),
      checked: l.key === layout.mode,
      keepOpen: true,
      onClick: () => setLayout({ mode: l.key }),
    })),
    { type: "divider" },
    { type: "label", label: t("layout.group.size") },
    ...SIZES.map((s) => ({
      key: `size-${s.key}`,
      label: t(`layout.size.${s.key}`),
      checked: s.key === layout.size,
      keepOpen: true,
      onClick: () => setLayout({ size: s.key }),
    })),
  ];

  // 菜单开着的时候点选项（keepOpen），要让菜单里的对勾跟着布局变化
  useEffect(() => {
    update(items);
    // items 每次渲染都是新数组，只在布局真的变了时同步
  }, [layout.mode, layout.size]);

  return (
    <>
      <button
        className={topbar.iconOnly}
        title={t("layout.title")}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={(event) => (isOpen ? close() : openFrom(event.currentTarget, items))}
      >
        <Icon name="grid" />
      </button>
      {menu}
    </>
  );
}
