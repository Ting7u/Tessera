// 给“还没读过 EXIF”的老图片后台补读（升级前导入的图片）。
// 按 id 顺序分批处理，每批一个事务，批与批之间让出事件循环，不卡界面。
import fs from "node:fs";
import type { ExifData, ImagesRepository } from "../../db/repositories";

const BATCH = 50;

export interface BackfillDeps {
  images: Pick<ImagesRepository, "pendingExif" | "applyExifBatch">;
  readExif: (file: string) => Promise<ExifData | null>;
  onChanged: () => void;
}

export function createBackfill({ images, readExif, onChanged }: BackfillDeps): {
  run(): Promise<void>;
} {
  let running = false;

  async function run(): Promise<void> {
    if (running) return;
    running = true;
    let afterId = 0;
    let touched = 0;
    let notified = 0;
    try {
      for (;;) {
        const rows = images.pendingExif(afterId, BATCH);
        if (!rows.length) break;
        afterId = rows[rows.length - 1].id;

        const entries: { id: number; exif: ExifData }[] = [];
        for (const row of rows) {
          // 文件暂时不可用（移动硬盘没插、被移走）：不标记完成，下次启动再试
          try {
            await fs.promises.access(row.path);
          } catch {
            continue;
          }
          const exif = await readExif(row.path);
          if (exif === null) return; // exifr 没装：整体放弃，装好后重启即可
          entries.push({ id: row.id, exif });
        }
        if (entries.length) {
          images.applyExifBatch(entries);
          touched += entries.length;
        }
        if (touched && Date.now() - notified > 2000) {
          notified = Date.now();
          onChanged(); // 通知刷新列表，限频
        }
        await new Promise<void>((resolve) => setImmediate(resolve));
      }
    } finally {
      running = false;
      if (touched) onChanged();
    }
  }

  return { run };
}
