// 图库列表：当前分类、搜索、排序、布局、已加载的图片与分页。
//
// 分页的内部状态（游标、已加载条数、请求代号……）不参与渲染，放在模块作用域，避免无谓的订阅和重渲染。
// 核心约定：
//  - 每次“从头加载”（reload）requestId 自增，较早发出的响应回来时发现代号不对就丢弃（防止慢响应覆盖新结果）
//  - 翻页（loadMore）必须用 applied（上次实际查询的条件），而不是此刻输入框里的搜索词
import type { ListCursor, SortSpec, TagChange } from "@shared/types";
import { api } from "@renderer/shared/api";
import { t } from "@renderer/shared/i18n";
import {
  getPageTitle,
  loadLayout,
  resolveSort,
  saveLayout,
  toViewItem,
  type LayoutChoice,
  type ViewItem,
} from "@renderer/shared/lib";
import { patchCachedItem, remember, replaceTagInCache, swapTag } from "../itemCache";
import type { SliceCreator } from "../types";

export const PAGE = 200; // 每页条数
const SEARCH_DEBOUNCE = 200;

export interface GallerySlice {
  /** 侧边栏当前分类：all / recent / duplicate / favorites / folder:<目录> / tag:<标签名> / smart:<id> */
  active: string;
  /** 页面标题：由 getPageTitle 算好存在这里；选分类、刷新侧边栏、切换语言时都会重新算 */
  title: string;
  query: string;
  /** null 表示默认（最近导入按导入时间，其余按拍摄时间） */
  sort: SortSpec | null;
  layout: LayoutChoice;
  items: ViewItem[];
  /** 当前筛选条件下的总数 */
  total: number;
  /** 图库总数（空图库引导用） */
  libraryTotal: number;

  selectCategory: (id: string) => void;
  setSort: (sort: SortSpec | null) => void;
  /** 改布局方式或大小（传要改的那一项），并记住；纯界面排布，不需要重新加载数据 */
  setLayout: (patch: Partial<LayoutChoice>) => void;
  /** composing：输入法正在合成（拼音还没选字），此时只更新输入框，不搜索；选字完成后再搜 */
  setQuery: (query: string, composing?: boolean) => void;
  /** 按当前分类和搜索词从头加载 limit 条 */
  reload: (limit?: number) => Promise<void>;
  /** 重新加载，但保持已经滚动到的条数。maxLoaded：已加载超过它就不刷新（避免大负载） */
  reloadLoaded: (options?: { maxLoaded?: number }) => Promise<void>;
  /** 加载下一页（滚动到底部时由 Gallery 触发） */
  loadMore: () => Promise<void>;
  /** 按当前分类和侧边栏数据重新算页面标题 */
  updateTitle: () => void;
  /** 一批图片的标签变了：同步缓存和列表 */
  applyTagChanges: (changes: TagChange[]) => void;
  /** 标签被重命名（to 为新名字）或删除（to 为 null）：同步缓存和列表里的旧名字 */
  replaceTag: (from: string, to: string | null) => void;
  /** 收藏状态变了：同步缓存和列表 */
  applyFavorite: (id: number, favorite: boolean) => void;
}

// ---------- 分页内部状态 ----------
let cursor: ListCursor | null = null; // 下一页游标，null 表示没有更多
let loaded = 0; // 当前已加载条数
let requestId = 0; // 每次“从头加载”自增，用来丢弃过期的响应
let loadingId: number | null = null; // 正在加载下一页的那一代 requestId
let searchTimer: ReturnType<typeof setTimeout> | undefined;
// 当前列表对应的查询条件；翻页必须用它，而不是最新输入的搜索词
let applied: { query: string; filter: string; sort: SortSpec } = {
  query: "",
  filter: "all",
  sort: resolveSort("all", null),
};

export const createGallerySlice: SliceCreator<GallerySlice> = (set, get) => ({
  active: "all",
  title: t("category.all"),
  query: "",
  sort: null,
  layout: loadLayout(),
  items: [],
  total: 0,
  libraryTotal: 0,

  selectCategory: (id) => {
    set({ active: id, title: getPageTitle(t, id, get().sidebar), selected: [] });
    void api.library.setActive(id); // 告诉主进程当前分类（浏览器扩展下载时要用）
    void get().reload();
  },

  setSort: (sort) => {
    set({ sort });
    void get().reload();
  },

  setLayout: (patch) => {
    const layout = { ...get().layout, ...patch };
    saveLayout(layout);
    set({ layout });
  },

  setQuery: (query, composing = false) => {
    set({ query }); // 输入框立即响应
    clearTimeout(searchTimer); // 先清掉旧定时器，免得它拿着拼音去搜索
    if (composing) return;
    searchTimer = setTimeout(() => void get().reload(), SEARCH_DEBOUNCE); // 查询防抖
  },

  reload: async (limit = PAGE) => {
    const id = ++requestId;
    const { query, active, sort } = get();
    applied = { query: query.trim(), filter: active, sort: resolveSort(active, sort) };

    const res = await api.library.list({ ...applied, cursor: null, limit });
    if (id !== requestId) return; // 期间又发起了新的加载，这次结果作废
    cursor = res.nextCursor;
    loaded = res.items.length;
    set({ items: remember(res.items.map(toViewItem)), total: res.total ?? res.items.length });
  },

  reloadLoaded: async ({ maxLoaded } = {}) => {
    if (maxLoaded !== undefined && loaded > maxLoaded) return;
    await get().reload(Math.max(PAGE, loaded));
  },

  loadMore: async () => {
    if (!cursor || loadingId === requestId) return;
    const id = (loadingId = requestId);
    try {
      const res = await api.library.list({ ...applied, cursor, limit: PAGE });
      if (id !== requestId) return;
      cursor = res.nextCursor;
      loaded += res.items.length;
      const more = remember(res.items.map(toViewItem));
      set((state) => ({ items: [...state.items, ...more] }));
    } finally {
      if (loadingId === id) loadingId = null;
    }
  },

  updateTitle: () => set({ title: getPageTitle(t, get().active, get().sidebar) }),

  applyTagChanges: (changes) => {
    const byId = new Map(changes.map((c) => [c.id, c.tags]));
    for (const [id, tags] of byId) patchCachedItem(id, { tags });
    // 即使这张图不在当前列表里（被搜索挤出），也触发一次更新，让读缓存的详情面板刷新
    set((state) => ({
      items: state.items.map((item) => {
        const tags = byId.get(item.id);
        return tags ? { ...item, tags } : item;
      }),
    }));
  },

  replaceTag: (from, to) => {
    replaceTagInCache(from, to);
    set((state) => ({
      items: state.items.map((item) =>
        item.tags.includes(from) ? { ...item, tags: swapTag(item.tags, from, to) } : item,
      ),
    }));
  },

  applyFavorite: (id, favorite) => {
    patchCachedItem(id, { favorite });
    set((state) => ({
      items: state.items.map((item) => (item.id === id ? { ...item, favorite } : item)),
    }));
  },
});
