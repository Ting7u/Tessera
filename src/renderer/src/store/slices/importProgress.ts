import type { ImportProgress, ImportRequest } from "@shared/types";
import { api } from "@renderer/shared/api";
import type { SliceCreator } from "../types";

export interface ImportProgressSlice {
  /** 导入进度（右下角浮层）；null 表示没有在显示 */
  progress: ImportProgress | null;
  setProgress: (progress: ImportProgress) => void;
  dismissProgress: () => void;
  /** 弹出系统选择框并在后台导入；用户取消选择时 canceled 为 true */
  startImport: (request: ImportRequest) => Promise<{ canceled: boolean }>;
}

export const createImportProgressSlice: SliceCreator<ImportProgressSlice> = (set) => ({
  progress: null,
  setProgress: (progress) => set({ progress }),
  dismissProgress: () => set({ progress: null }),
  startImport: (request) => api.importer.import(request),
});
