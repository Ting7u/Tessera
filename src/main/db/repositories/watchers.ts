// 被监听的文件夹（重启后据此恢复监听）。
import type { ImportMode } from "@shared/types";
import type { AppDatabase } from "../database";

export interface WatcherRecord {
  path: string;
  mode: ImportMode;
}

export interface WatchersRepository {
  all(): WatcherRecord[];
  add(record: WatcherRecord): void;
  remove(dir: string): void;
}

export function createWatchersRepository({ db, prepare }: AppDatabase): WatchersRepository {
  const list = db.prepare("SELECT path, mode FROM watchers");
  const insert = db.prepare("INSERT OR IGNORE INTO watchers (path, mode) VALUES (?, ?)");
  return {
    all: () => list.all() as WatcherRecord[],
    add({ path: dir, mode }) {
      insert.run(dir, mode);
    },
    remove(dir) {
      prepare("DELETE FROM watchers WHERE path = ?").run(String(dir));
    },
  };
}
