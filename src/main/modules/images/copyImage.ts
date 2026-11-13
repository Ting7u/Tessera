// 复制图片到剪贴板：任意图片 → PNG 字节；解码不了的格式（RAW 等）退化为复制文件路径。
import fs from "node:fs";
import { clipboard, ClipboardItem, nativeImage } from "electron";
import type { CopyImageResult } from "@shared/types";
import { loadSharp } from "../../core/sharp";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** 按文件头判断是不是 PNG（纯函数；不信扩展名，防止改名文件） */
export const isPngHeader = (head: Uint8Array): boolean =>
  Buffer.from(head).subarray(0, 8).equals(PNG_MAGIC);

async function isPng(file: string): Promise<boolean> {
  const fh = await fs.promises.open(file, "r");
  try {
    const head = Buffer.alloc(8);
    await fh.read(head, 0, 8, 0);
    return isPngHeader(head);
  } finally {
    await fh.close();
  }
}

/** 把任意图片变成 PNG 字节：直通 > sharp 异步转码 > nativeImage 兜底；都解不了返回 null */
export async function toPngBuffer(file: string): Promise<Buffer | null> {
  // 1. 原本就是 PNG：原样读取，零解码，画质与原图完全一致
  if (await isPng(file)) return fs.promises.readFile(file);

  // 2. 其他格式：sharp 在线程池里解码，不阻塞主进程（PNG 无损，压缩等级只影响速度和体积）
  try {
    const sharp = await loadSharp();
    if (sharp) return await sharp(file).rotate().png({ compressionLevel: 1 }).toBuffer();
  } catch {
    /* 继续兜底 */
  }

  // 3. sharp 解不了、但系统能解的格式
  const image = nativeImage.createFromPath(file);
  return image.isEmpty() ? null : image.toPNG();
}

/**
 * 同一张图重复点击复用进行中的任务；不同图片以最后一次点击为准
 * （较早的任务算完后发现自己已被取代，就不再写剪贴板）
 */
export function createImageCopier(): (file: string) => Promise<CopyImageResult> {
  let copySeq = 0;
  const inflight = new Map<string, Promise<CopyImageResult>>(); // file -> Promise

  return (file) => {
    const existing = inflight.get(file);
    if (existing) return existing;

    const seq = ++copySeq;
    const task = (async (): Promise<CopyImageResult> => {
      try {
        const png = await toPngBuffer(file);
        if (seq !== copySeq) return { ok: false, error: "已被新的复制操作取代" };
        if (!png) {
          clipboard.writeText(file);
          return { ok: true, kind: "path" };
        }
        await clipboard.write([
          new ClipboardItem({
            "image/png": new Blob([new Uint8Array(png)], { type: "image/png" }),
          }),
        ]);
        return { ok: true, kind: "image" };
      } catch (err) {
        return { ok: false, error: `复制图片失败：${(err as Error).message}` };
      } finally {
        inflight.delete(file);
      }
    })();

    inflight.set(file, task);
    return task;
  };
}
