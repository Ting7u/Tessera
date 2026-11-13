import type { ImportMode } from "./image";

export interface ImportRequest {
  source: "files" | "folder";
  mode: ImportMode;
  /** 选文件夹时：是否同时监听这个文件夹的新增图片 */
  watch: boolean;
}

export interface ImportProgress {
  jobId: string;
  total: number;
  done: number;
  added: number;
  skipped: number;
  failed: number;
  current: string;
  finished: boolean;
}

export interface DownloadRequest {
  urls: string[];
  pageUrl?: string;
  /** 界面当前所在的分类（侧边栏 filter）；在某个文件夹里时下载到该文件夹 */
  filter?: string;
}

export interface DownloadResult {
  canceled: boolean;
  /** 保存目录；没有可下载的链接或用户取消选择时为 null */
  dir: string | null;
  added: number;
  skipped: number;
  failed: number;
  /** 第一个失败原因 */
  reason: string;
}
