import type { SliceCreator } from "../types";

export interface SelectionSlice {
  /** 已选图片 id */
  selected: number[];
  toggleSelected: (id: number) => void;
  clearSelected: () => void;
}

export const createSelectionSlice: SliceCreator<SelectionSlice> = (set) => ({
  selected: [],
  toggleSelected: (id) =>
    set((state) => ({
      selected: state.selected.includes(id)
        ? state.selected.filter((x) => x !== id)
        : [...state.selected, id],
    })),
  clearSelected: () => set({ selected: [] }),
});
