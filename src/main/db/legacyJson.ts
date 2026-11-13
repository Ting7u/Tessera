// 一次性迁移旧版 library.json（单事务批量写入），完成后改名为 .migrated 备份。
import fs from "node:fs";
import type { AppDatabase } from "./database";
import type { ImagesRepository, NewImage } from "./repositories/images";
import type { WatcherRecord, WatchersRepository } from "./repositories/watchers";

interface LegacyData {
  items?: NewImage[];
  watchers?: WatcherRecord[];
}

/** 返回迁移的图片数；没有旧文件、库里已有图片或文件损坏都返回 0 */
export function importLegacyJson(
  database: AppDatabase,
  images: ImagesRepository,
  watchers: WatchersRepository,
  file: string,
): number {
  if (!fs.existsSync(file) || images.stats().total > 0) return 0;
  let data: LegacyData;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8")) as LegacyData;
  } catch {
    return 0;
  }
  let count = 0;
  database.db.transaction(() => {
    for (const item of data.items ?? []) if (images.add(item)) count++;
    for (const w of data.watchers ?? []) watchers.add(w);
  })();
  fs.renameSync(file, `${file}.migrated`);
  return count;
}
