import { api } from "@renderer/shared/api";
import { t } from "@renderer/shared/i18n";
import { getCachedItem } from "../itemCache";
import type { SliceCreator } from "../types";

export interface FavoritesSlice {
  toggleFavorite: (id: number) => Promise<void>;
}

export const createFavoritesSlice: SliceCreator<FavoritesSlice> = (_set, get) => ({
  toggleFavorite: async (id) => {
    // 优先读缓存：图片被搜索条件挤出列表时，缓存里仍有它
    const next = !getCachedItem(id)?.favorite;
    if (!(await api.images.setFavorite(id, next))) return;
    get().showToast(next ? t("toast.favorited") : t("toast.unfavorited"), {
      duration: 2000,
      type: "success",
    });
    get().applyFavorite(id, next);
    void get().refreshSidebar();
    // 在“我的收藏”或智能分类里改了收藏状态，列表本身也要跟着变
    const { active } = get();
    if (active === "favorites" || active.startsWith("smart:")) void get().reloadLoaded();
  },
});
