// 页面标题：由当前分类的 id 推出来，而不是把一句写死的文字存起来。
// 这样切换语言后，标题能重新算成另一种语言。
// t 是翻译函数；sidebar 是侧边栏数据（文件夹、智能分类的名字要从这里查）
import type { SidebarData } from "@shared/types";
import type { TranslateFn } from "@shared/i18n";

const BUILTIN = new Set(["all", "recent", "duplicate", "favorites"]);

export function getPageTitle(t: TranslateFn, active: string, sidebar?: SidebarData): string {
  if (active.startsWith("folder:")) {
    const dir = active.slice("folder:".length);
    const folder = sidebar?.folders?.find((f) => f.key === active);
    const name = folder?.label ?? (dir.split(/[\\/]/).filter(Boolean).pop() || dir);
    return t("title.folder", { name });
  }
  if (active.startsWith("tag:")) return t("title.tag", { name: active.slice("tag:".length) });
  if (active.startsWith("smart:")) {
    const smart = sidebar?.smart?.find((s) => s.key === active);
    return t("title.smart", { name: smart?.name ?? "" });
  }
  return BUILTIN.has(active) ? t(`category.${active}`) : active;
}
