import { broadcast, handle } from "../../core/ipc";
import type { Downloads } from "./downloads";

export function registerDownloadsIpc({
  downloads,
  ui,
}: {
  downloads: Downloads;
  ui: { activeFilter: string };
}): void {
  // 渲染进程只传链接和当前分类，保存位置由 downloads 决定
  handle("library:download", ({ window }, request) => {
    const p = request && typeof request === "object" ? request : ({} as Partial<typeof request>);
    return downloads.enqueue({
      urls: p.urls,
      pageUrl: p.pageUrl,
      filter: p.filter,
      win: window,
      onStatus: (notice) => broadcast("library:notice", notice), // 界面内提示，不弹系统通知
    });
  });
  handle("library:cancel-downloads", () => {
    downloads.cancelAll();
    return true;
  });
  handle("library:get-download-dir", () => downloads.savedDir());
  handle("library:choose-download-dir", ({ window }) => downloads.chooseDir(window));

  // 界面当前所在的分类：浏览器扩展触发下载时，用它决定“当前文件夹”
  handle("library:set-active", (_ctx, filter) => {
    ui.activeFilter = typeof filter === "string" ? filter.slice(0, 2000) : "all";
    return true;
  });
}
