// 主进程的图片记录（ImageRecord）→ 界面使用的数据结构（ViewItem）
import type { ImageRecord } from "@shared/types";
import { originalUrl, thumbUrl } from "@shared/protocol";
import { buildExifRows, type ExifRow } from "./formatExif";

export interface ViewItem {
  id: number;
  name: string;
  /** 宽 / 高；没有尺寸时为 1 */
  ratio: number;
  /** 无缩略图时的占位渐变色相 */
  hue: number;
  size: string;
  /** 拍摄日期（没有 EXIF 时是文件修改日期） */
  date: string;
  /** 导入日期 */
  addedDate: string;
  place: string;
  duplicate: boolean;
  favorite: boolean;
  tags: string[];
  thumb: string | null;
  /** 原图地址，由主进程按 id 查路径后返回 */
  original: string;
  dimensions: string;
  format: string;
  path: string;
  /** 是否是“复制到图库托管”的图片；要显示的文字由详情面板按当前语言翻译，这里不存文字 */
  managed: boolean;
  exifRows: ExifRow[];
}

export const fmtSize = (bytes: number): string =>
  bytes >= 1048576
    ? `${(bytes / 1048576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const fmtDate = (ms: number): string => new Date(ms).toLocaleDateString("sv-SE"); // YYYY-MM-DD

export function toViewItem(record: ImageRecord): ViewItem {
  return {
    id: record.id,
    name: record.name,
    ratio: record.width && record.height ? record.width / record.height : 1,
    hue: (record.id * 47 + 188) % 360,
    size: fmtSize(record.size),
    date: fmtDate(record.takenAt),
    addedDate: fmtDate(record.addedAt),
    place: "—",
    duplicate: record.dupGroup != null,
    favorite: !!record.favorite,
    tags: record.tags ?? [],
    thumb: record.thumb ? thumbUrl(record.thumb) : null,
    original: originalUrl(record.id),
    dimensions: record.width ? `${record.width} × ${record.height} px` : "—",
    format: record.format,
    path: record.path,
    managed: !!record.managed,
    exifRows: buildExifRows(record),
  };
}
