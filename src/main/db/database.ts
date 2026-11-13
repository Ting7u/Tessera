// 打开 SQLite 连接：pragma、自定义 SQL 函数、迁移、预编译语句缓存。
import path from "node:path";
import Database from "better-sqlite3";
import { migrations } from "./migrations";

export type Statement = Database.Statement;

export interface AppDatabase {
  readonly db: Database.Database;
  /** 动态 SQL 的预编译缓存：同一条 SQL 文本只编译一次 */
  prepare(sql: string): Statement;
  close(): void;
}

function migrate(db: Database.Database): void {
  let version = db.pragma("user_version", { simple: true }) as number;
  while (version < migrations.length) {
    const sql = migrations[version];
    const next = version + 1;
    db.transaction(() => {
      db.exec(sql);
      db.pragma(`user_version = ${next}`);
    })();
    version = next;
  }
}

export function openDatabase(file: string): AppDatabase {
  const db = new Database(file);
  db.pragma("journal_mode = WAL"); // 读写互不阻塞；提交不再每次 fsync
  db.pragma("synchronous = NORMAL"); // WAL 下的推荐值：崩溃不会损坏库，最多丢最后一次未落盘的提交
  db.pragma("foreign_keys = ON");
  db.pragma("temp_store = MEMORY");
  db.pragma("cache_size = -65536"); // 64MB 页缓存
  db.pragma("mmap_size = 268435456"); // 256MB 内存映射，热数据读取接近内存速度
  db.function("dirname", { deterministic: true }, (p) => path.dirname(String(p))); // 迁移 v3 要用，必须在 migrate 之前注册
  migrate(db);

  const cache = new Map<string, Statement>();
  return {
    db,
    prepare(sql) {
      let stmt = cache.get(sql);
      if (!stmt) {
        stmt = db.prepare(sql);
        cache.set(sql, stmt);
      }
      return stmt;
    },
    close() {
      try {
        db.pragma("optimize");
      } catch {
        /* 优化失败不影响关闭 */
      }
      db.close();
    },
  };
}
