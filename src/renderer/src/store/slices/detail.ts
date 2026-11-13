import type { SliceCreator } from "../types";

export interface DetailSlice {
  showDetail: boolean;
  /** 详情面板正在展示的图片 id（点击图片打开详情时不会选中它） */
  detailId: number | null;
  /** 传入 id：打开这张图的详情；不传：打开最后一个已选图片的详情（选择栏的“信息”） */
  openDetail: (id?: number) => void;
  closeDetail: () => void;
  /** 在已加载的列表里切到上一张（delta = -1）或下一张（delta = 1）；必要时先加载下一页 */
  stepDetail: (delta: -1 | 1) => Promise<void>;
}

export const createDetailSlice: SliceCreator<DetailSlice> = (set, get) => ({
  showDetail: false,
  detailId: null,

  openDetail: (id) => {
    const { selected } = get();
    const target = id ?? selected[selected.length - 1];
    if (target === undefined) return;
    set({ showDetail: true, detailId: target });
  },
  closeDetail: () => set({ showDetail: false, detailId: null }),

  stepDetail: async (delta) => {
    const { detailId } = get();
    const find = (): number => get().items.findIndex((item) => item.id === detailId);
    let index = find();
    if (index < 0) return;
    if (delta > 0 && index === get().items.length - 1) {
      await get().loadMore();
      index = find();
    }
    const next = get().items[index + delta];
    // 加载期间用户可能已经关掉详情或换了别的图，只有还停留在原来那张时才切换
    if (next && get().showDetail && get().detailId === detailId) set({ detailId: next.id });
  },
});
