import type { DownloadResult } from "@shared/types";

/** 把下载结果写成一句话，用于提示 */
export function describeResult(r: Partial<DownloadResult> & { canceled: boolean }): string {
  if (r.canceled) return r.added ? `已取消下载（已保存 ${r.added} 张）` : "已取消下载";
  const parts: string[] = [];
  if (r.added) parts.push(`已保存 ${r.added} 张到 ${r.dir}`);
  if (r.skipped) parts.push(`跳过重复 ${r.skipped} 张`);
  if (r.failed) parts.push(`失败 ${r.failed} 张${r.reason ? `（${r.reason}）` : ""}`);
  return parts.join("，") || "没有可下载的图片";
}
