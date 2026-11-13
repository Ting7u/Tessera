// 导入器：扫描 → 哈希去重 → EXIF → 缩略图 → （可选）复制托管 → 入库。
// 并发 3；任务整体串行排队；每成功 20 张通知一次。
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { ImportMode, ImportProgress } from "@shared/types";
import { createLogger } from "../../core/logger";
import type { ExifData, ImagesRepository } from "../../db/repositories";
import { copyIntoLibrary } from "./copyIntoLibrary";
import { hashFile } from "./hash";
import { collectImages } from "./scanner";

const log = createLogger("import");
const CONCURRENCY = 3;

/** 读取 EXIF；null 表示 exifr 不可用（先入库，稍后由后台补读） */
export type ExifReader = (file: string) => Promise<ExifData | null>;
/** 生成缩略图并返回原图宽高；解码失败返回 null（该图仍可入库，只是没有预览） */
export type ThumbnailCreator = (
  file: string,
  outFile: string,
) => Promise<{ width: number; height: number } | null>;

export interface ImporterDeps {
  images: ImagesRepository;
  dirs: { thumbs: string; library: string };
  emit: (state: ImportProgress) => void;
  onChanged: () => void;
  readExif: ExifReader;
  createThumbnail: ThumbnailCreator;
}

export interface EnqueueOptions {
  mode?: ImportMode;
  /** 静默：不发进度事件（启动补扫、下载入库用） */
  silent?: boolean;
}

export interface Importer {
  /** 入队后台导入，不阻塞调用方。前一个任务没完成时排队等待 */
  enqueueImport(inputs: string[], options?: EnqueueOptions): Promise<ImportProgress>;
}

type ImportOutcome = "added" | "skipped";

export function createImporter({
  images,
  dirs,
  emit,
  onChanged,
  readExif,
  createThumbnail,
}: ImporterDeps): Importer {
  const pending = new Set<string>(); // 正在处理中的哈希，防止并发导入同一内容
  let chain: Promise<unknown> = Promise.resolve(); // 排队的是整个导入任务，不是单张图片

  async function importOne(file: string, mode: ImportMode): Promise<ImportOutcome> {
    if (images.hasSource(file)) return "skipped"; // 路径已导入过
    const stat = await fs.promises.stat(file);
    const hash = await hashFile(file);
    if (images.hasHash(hash) || pending.has(hash)) return "skipped"; // 内容重复
    pending.add(hash);
    try {
      const exifRaw = await readExif(file); // null：exifr 不可用，稍后由后台补读
      const exif: Partial<ExifData> = exifRaw ?? {};
      const thumbName = `${hash}.jpg`;
      const meta = await createThumbnail(file, path.join(dirs.thumbs, thumbName));
      const managed = mode === "copy";
      const finalPath = managed ? await copyIntoLibrary(file, stat, hash, dirs.library) : file;

      const id = images.add({
        name: path.basename(file),
        path: finalPath,
        sourcePath: file,
        managed,
        hash,
        size: stat.size,
        width: meta?.width ?? 0,
        height: meta?.height ?? 0,
        format: path.extname(file).slice(1).toUpperCase(),
        takenAt: exif.takenAt ?? Math.round(stat.mtimeMs), // 优先用 EXIF 拍摄时间，没有则用文件修改时间
        hasExifDate: exif.takenAt != null,
        camera: exif.camera,
        lens: exif.lens,
        iso: exif.iso,
        aperture: exif.aperture,
        shutter: exif.shutter,
        focalLength: exif.focalLength,
        gpsLat: exif.gpsLat,
        gpsLon: exif.gpsLon,
        orientation: exif.orientation,
        exifDone: exifRaw !== null,
        addedAt: Date.now(),
        thumb: meta ? thumbName : null,
      });
      if (!id) {
        // 并发下同内容已被写入：撤销刚复制的副本
        if (managed) await fs.promises.unlink(finalPath).catch(() => {});
        return "skipped";
      }
      return "added";
    } finally {
      pending.delete(hash);
    }
  }

  async function run(inputs: string[], mode: ImportMode, silent: boolean): Promise<ImportProgress> {
    const files = await collectImages(inputs);
    const state: ImportProgress = {
      jobId: crypto.randomUUID(),
      total: files.length,
      done: 0,
      added: 0,
      skipped: 0,
      failed: 0,
      current: "",
      finished: false,
    };
    if (!silent) emit(state);

    let cursor = 0;
    const worker = async (): Promise<void> => {
      while (cursor < files.length) {
        const file = files[cursor++];
        try {
          const result = await importOne(file, mode);
          if (result === "added") state.added++;
          else state.skipped++;
        } catch (err) {
          state.failed++;
          log.error("failed:", file, err);
        }
        state.done++;
        state.current = path.basename(file);
        if (!silent) emit(state);
        if (state.added && state.added % 20 === 0) onChanged(); // 每成功 20 张通知一次
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker));

    state.finished = true;
    if (!silent) emit(state);
    onChanged();
    return state;
  }

  return {
    enqueueImport(inputs, { mode = "reference", silent = false } = {}) {
      const task = chain.then(() => run(inputs, mode, silent));
      chain = task.catch((err) => log.error("job error:", err));
      return task;
    },
  };
}
