import { api } from "@renderer/shared/api";
import { t } from "@renderer/shared/i18n";
import type { SliceCreator } from "../types";

export interface DownloadsSlice {
  /**
   * 从网址下载图片入库。保存位置由主进程决定：当前在某个文件夹里就存到该文件夹，
   * 否则用已选的下载文件夹（第一次会让用户选）。
   */
  downloadUrls: (urls: string[], pageUrl?: string) => Promise<void>;
}

export const createDownloadsSlice: SliceCreator<DownloadsSlice> = (_set, get) => ({
  downloadUrls: async (urls, pageUrl) => {
    const { showToast, active } = get();
    if (!urls.length) return;
    showToast(t("toast.downloading", { count: urls.length }), { duration: 0, downloading: true });
    try {
      const r = await api.downloads.download({ urls, pageUrl, filter: active });
      if (r.canceled) {
        showToast(t("toast.downloadCanceled"));
        return;
      }
      const parts: string[] = [];
      if (r.added) parts.push(t("toast.downloadSaved", { count: r.added, dir: r.dir }));
      if (r.skipped) parts.push(t("toast.downloadSkipped", { count: r.skipped }));
      if (r.failed) {
        parts.push(
          t("toast.downloadFailed", { count: r.failed }) +
            (r.reason ? t("toast.reason", { reason: r.reason }) : ""),
        );
      }
      showToast(parts.join(t("common.comma")) || t("toast.nothingToDownload"));
    } catch (err) {
      console.error(err);
      showToast(t("toast.downloadError"));
    }
  },
});
