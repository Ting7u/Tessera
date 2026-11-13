// EXIF 解析（纯函数，不依赖 exifr / electron，可单元测试）。
import type { ExifData } from "../../db/repositories";

/** 只读这些标签，别的不解析（省时间） */
export const EXIF_PICK = [
  "Make",
  "Model",
  "LensModel",
  "DateTimeOriginal",
  "CreateDate",
  "ISO",
  "ISOSpeedRatings",
  "FNumber",
  "ExposureTime",
  "FocalLength",
  "Orientation",
];

/** exifr 返回的原始字段（只列用到的；值来自文件，类型不可信） */
export interface RawExif {
  Make?: unknown;
  Model?: unknown;
  LensModel?: unknown;
  DateTimeOriginal?: unknown;
  CreateDate?: unknown;
  ISO?: unknown;
  ISOSpeedRatings?: unknown;
  FNumber?: unknown;
  ExposureTime?: unknown;
  FocalLength?: unknown;
  Orientation?: unknown;
}

export interface RawGps {
  latitude?: number;
  longitude?: number;
}

// EXIF 字符串常带结尾的 \0 和空格
const clean = (v: unknown): string => (typeof v === "string" ? v.replace(/\0/g, "").trim() : "");

// 正数才有意义（光圈、快门、ISO 等都不会是 0 或负数）；有些相机把数值存成数组
const positive = (v: unknown): number | null => {
  const n = Array.isArray(v) ? Number(v[0]) : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * "2026:10:26 16:24:00" → 毫秒时间戳。EXIF 时间不带时区，按本机本地时间解释，
 * 这样界面显示的就是相机上的原始时间。无效值（"0000:00:00 ..."、未来时间）返回 null。
 */
export function parseExifDate(value: unknown, now: number = Date.now()): number | null {
  if (typeof value !== "string") return null;
  const m = /^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(value.trim());
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number);
  if (y < 1990) return null;
  const date = new Date(y, mo - 1, d, h, mi, s);
  if (date.getMonth() !== mo - 1 || date.getDate() !== d) return null; // 13 月、32 日这类溢出
  const t = date.getTime();
  return Number.isNaN(t) || t > now + 864e5 ? null : t;
}

export function normalizeExif(rawInput: RawExif | null | undefined, gps?: RawGps | null): ExifData {
  const raw = rawInput ?? {};
  const make = clean(raw.Make);
  const model = clean(raw.Model);
  // "Canon" + "Canon EOS R5" → "Canon EOS R5"；"SONY" + "ILCE-7M4" → "SONY ILCE-7M4"
  const sameBrand =
    !!model && !!make && model.toLowerCase().startsWith(make.toLowerCase().split(" ")[0]);
  const camera = model ? (make && !sameBrand ? `${make} ${model}` : model) : make;

  const iso = positive(raw.ISO ?? raw.ISOSpeedRatings);
  const o = raw.Orientation;
  const orientation = typeof o === "number" && Number.isInteger(o) && o >= 1 && o <= 8 ? o : null;
  const lat = gps?.latitude;
  const lon = gps?.longitude;
  const validGps =
    typeof lat === "number" &&
    typeof lon === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180 &&
    !(lat === 0 && lon === 0);

  return {
    takenAt: parseExifDate(raw.DateTimeOriginal) ?? parseExifDate(raw.CreateDate), // 不用 DateTime：那是修改时间
    camera: camera || null,
    lens: clean(raw.LensModel) || null,
    iso: iso ? Math.round(iso) : null,
    aperture: positive(raw.FNumber),
    shutter: positive(raw.ExposureTime),
    focalLength: positive(raw.FocalLength),
    gpsLat: validGps ? lat : null,
    gpsLon: validGps ? lon : null,
    orientation,
  };
}
