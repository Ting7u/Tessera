/** 入库方式：reference 引用原路径；copy 复制到图库托管目录 */
export type ImportMode = "reference" | "copy";

/** 主进程返回给界面的图片记录（数据库行 → 驼峰字段） */
export interface ImageRecord {
  id: number;
  name: string;
  /** 当前文件位置（托管模式下是图库内副本） */
  path: string;
  managed: boolean;
  size: number;
  width: number;
  height: number;
  format: string;
  /** 拍摄时间（没有 EXIF 时是文件修改时间），毫秒时间戳 */
  takenAt: number;
  /** 导入时间，毫秒时间戳 */
  addedAt: number;
  /** 缩略图文件名；null 表示没有缩略图 */
  thumb: string | null;
  /** 相似图片分组号；null 表示没有相似图 */
  dupGroup: number | null;
  favorite: boolean;
  camera: string | null;
  lens: string | null;
  iso: number | null;
  aperture: number | null;
  shutter: number | null;
  focalLength: number | null;
  gpsLat: number | null;
  gpsLon: number | null;
  orientation: number | null;
  hasExifDate: boolean;
  tags: string[];
}

/** 一批图片的标签变了：每张图片最新的标签列表 */
export interface TagChange {
  id: number;
  tags: string[];
}

export type CopyImageResult =
  | { ok: true; kind: "image" | "path" }
  | { ok: false; error: string };
