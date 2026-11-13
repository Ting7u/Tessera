import { api } from "@renderer/shared/api";
import { t } from "@renderer/shared/i18n";
import type { SliceCreator } from "../types";

export interface MoveSlice {
  /** 拖到侧边栏文件夹上时用：目标必须是图库里已有的文件夹；成功提示由主进程发出（带“撤销”按钮） */
  moveImages: (ids: number[], dir: string) => Promise<void>;
}

export const createMoveSlice: SliceCreator<MoveSlice> = (_set, get) => ({
  moveImages: async (ids, dir) => {
    if (!ids.length) return;
    try {
      const res = await api.move.move({ ids, dir });
      if (res.ok) get().clearSelected();
      else get().showToast(res.error || t("toast.moveFailed"));
    } catch (err) {
      console.error(err);
      get().showToast(t("toast.moveFailedRetry"));
    }
  },
});
