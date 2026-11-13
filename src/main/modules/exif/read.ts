// EXIF 读取：依赖 exifr（纯 JS，支持 JPEG / TIFF / HEIC / 多数 RAW）。解析在 normalize.ts。
import type { ExifData } from "../../db/repositories";
import { createLogger } from "../../core/logger";
import { EXIF_PICK, normalizeExif, type RawExif, type RawGps } from "./normalize";

const log = createLogger("exif");
let warned = false;

interface Exifr {
  parse(file: string, options: Record<string, unknown>): Promise<RawExif | undefined>;
  gps(file: string): Promise<RawGps | undefined>;
}

/**
 * 读取一个文件的 EXIF。读不到（没有 EXIF、格式不支持、文件损坏）返回全空对象；
 * exifr 没安装则返回 null，让调用方知道“没有尝试过”，之后补装依赖还能补读。
 */
export async function readExif(file: string): Promise<ExifData | null> {
  let exifr: Exifr;
  try {
    const mod = (await import("exifr")) as { default?: Exifr } & Partial<Exifr>;
    exifr = (mod.default ?? mod) as Exifr;
  } catch {
    if (!warned) {
      warned = true;
      log.warn("未安装 exifr，已跳过 EXIF 读取。请运行：npm i exifr");
    }
    return null;
  }
  let raw: RawExif | undefined;
  let gps: RawGps | undefined;
  // reviveValues / translateValues 关掉：拿原始字符串和数字，时间由我们自己按本地时间解析
  try {
    raw = await exifr.parse(file, { pick: EXIF_PICK, translateValues: false, reviveValues: false });
  } catch {
    /* 无 EXIF */
  }
  try {
    gps = await exifr.gps(file);
  } catch {
    /* 无 GPS */
  }
  return normalizeExif(raw, gps);
}
