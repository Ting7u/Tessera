// EXIF 数值 → 展示文本（纯函数）
// 行名（拍摄时间、相机……）不在这里翻译：每一行只给一个 id，由详情面板按当前语言取名字（exif.<id>）。
// 这样 toViewItem 里算好并缓存的数据，切换语言后也不会过期
import type { ImageRecord } from "@shared/types";

export interface ExifRow {
  id: string;
  value: string;
}

export const formatDateTime = (ms: number): string =>
  new Date(ms).toLocaleString("sv-SE").slice(0, 16); // 2026-10-26 16:24

/** 慢于 1/3 秒的写成小数（0.8 s、2 s），其余写成分数（1/250 s） */
export const formatShutter = (s: number): string =>
  s >= 0.3 ? `${+s.toFixed(1)} s` : `1/${Math.round(1 / s)} s`;

export const formatAperture = (a: number): string => `f/${+a.toFixed(1)}`;
export const formatFocalLength = (f: number): string => `${+f.toFixed(1)} mm`;

export const formatGps = (lat: number, lon: number): string =>
  `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? "E" : "W"}`;

export type ExifSource = Pick<
  ImageRecord,
  | "hasExifDate"
  | "takenAt"
  | "camera"
  | "lens"
  | "aperture"
  | "shutter"
  | "iso"
  | "focalLength"
  | "gpsLat"
  | "gpsLon"
>;

/** 详情面板的 EXIF 行：只包含确实读到的字段；一个都没有时返回空数组 */
export function buildExifRows(r: ExifSource): ExifRow[] {
  const rows: ExifRow[] = [];
  if (r.hasExifDate) rows.push({ id: "takenAt", value: formatDateTime(r.takenAt) });
  if (r.camera) rows.push({ id: "camera", value: r.camera });
  if (r.lens) rows.push({ id: "lens", value: r.lens });

  const exposure = [
    r.aperture && formatAperture(r.aperture),
    r.shutter && formatShutter(r.shutter),
    r.iso && `ISO ${r.iso}`,
  ].filter(Boolean);
  if (exposure.length) rows.push({ id: "exposure", value: exposure.join(" · ") });

  if (r.focalLength) rows.push({ id: "focalLength", value: formatFocalLength(r.focalLength) });
  if (r.gpsLat != null && r.gpsLon != null)
    rows.push({ id: "gps", value: formatGps(r.gpsLat, r.gpsLon) });
  return rows;
}
