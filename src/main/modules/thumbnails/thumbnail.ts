// 缩略图：长边最大 480 的 JPEG。依次尝试 nativeImage → 系统缩略图服务（Win / Mac）→ sharp。
import fs from "node:fs";
import { nativeImage } from "electron";
import { imageSize } from "image-size"; // 只读文件头取宽高，支持 WebP / AVIF / HEIC 等
import { loadSharp } from "../../core/sharp";

const MAX = 480;

export interface ImageSize {
  width: number;
  height: number;
}

/** 用 image-size 读文件头里记录的真实宽高；读不出来返回 null */
export function readSize(file: string): ImageSize | null {
  try {
    const { width, height } = imageSize(file);
    return width && height ? { width, height } : null;
  } catch {
    return null;
  }
}

/**
 * 备用方案：用 sharp 生成缩略图。
 * 用在 nativeImage 解不了、系统缩略图服务也用不了的情况（Linux 上的 WebP / AVIF 等）。
 * sharp 不支持的格式（HEIC、RAW）仍返回 null
 */
async function createThumbnailWithSharp(file: string, outFile: string): Promise<ImageSize | null> {
  const sharp = await loadSharp();
  if (!sharp) return null;
  try {
    const image = sharp(file, { failOn: "none" });
    const meta = await image.metadata();
    await image
      .resize({ width: MAX, height: MAX, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toFile(outFile);
    return { width: meta.width || 0, height: meta.height || 0 };
  } catch {
    return null;
  }
}

/** 生成缩略图并返回原图宽高；解码失败返回 null（该图仍可入库，只是没有预览） */
export async function createThumbnail(file: string, outFile: string): Promise<ImageSize | null> {
  let img = nativeImage.createFromPath(file);
  let width = 0;
  let height = 0;

  if (!img.isEmpty()) {
    ({ width, height } = img.getSize());
  } else {
    // WebP / HEIC / RAW 等 nativeImage 解不了的格式：先交给系统缩略图服务（仅 Windows / macOS 可用）
    let sysImg: ReturnType<typeof nativeImage.createFromPath> | null = null;
    if (process.platform === "win32" || process.platform === "darwin") {
      try {
        sysImg = await nativeImage.createThumbnailFromPath(file, { width: MAX, height: MAX });
      } catch {
        /* 系统不支持这种格式，往下走备用方案 */
      }
    }
    // 系统服务没有结果（含 Linux，它没有这个接口）：用 sharp 兜底
    if (!sysImg || sysImg.isEmpty()) return createThumbnailWithSharp(file, outFile);
    img = sysImg;
    // 系统返回的只是缩略图，它的尺寸不是原图尺寸；原图宽高要从文件头里读（读不出来就记 0）
    ({ width, height } = readSize(file) ?? { width: 0, height: 0 });
  }

  const size = img.getSize();
  const scale = Math.min(1, MAX / Math.max(size.width, size.height));
  const small =
    scale < 1 ? img.resize({ width: Math.round(size.width * scale), quality: "good" }) : img;
  await fs.promises.writeFile(outFile, small.toJPEG(82));
  return { width, height };
}
