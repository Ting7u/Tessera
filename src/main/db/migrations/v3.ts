// v3：收藏、相似图感知哈希、所在文件夹、智能分类。dirname() 是 database.ts 在迁移前注册的自定义 SQL 函数
// 已发布的迁移永远不要修改，改表结构请追加新的版本。
export const v3 = `
  ALTER TABLE images ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE images ADD COLUMN phash       TEXT;        -- NULL 表示还没算；'' 表示无法计算（不再重试）
  ALTER TABLE images ADD COLUMN dir         TEXT;        -- 导入时原始文件所在目录，侧边栏“文件夹”按它分组
  UPDATE images SET dir = dirname(source_path);
  CREATE INDEX idx_images_dir ON images (dir);
  CREATE INDEX idx_images_fav ON images (taken_at DESC, id DESC) WHERE is_favorite = 1;

  CREATE TABLE smart_albums (
    id         INTEGER PRIMARY KEY,
    name       TEXT    NOT NULL,
    rule       TEXT    NOT NULL,                         -- JSON：{ days, tag, minSizeMB, favorite }
    created_at INTEGER NOT NULL
  );
  `;
