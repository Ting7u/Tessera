// v1：初始表结构：图片、标签、监听文件夹、文件名全文索引
// 已发布的迁移永远不要修改，改表结构请追加新的版本。
export const v1 = `
  CREATE TABLE images (
    id          INTEGER PRIMARY KEY,
    name        TEXT    NOT NULL,
    path        TEXT    NOT NULL,              -- 当前文件位置（托管模式下是图库内副本）
    source_path TEXT    NOT NULL UNIQUE,       -- 导入时的原始路径，用于按路径快速跳过
    managed     INTEGER NOT NULL DEFAULT 0,
    hash        TEXT    NOT NULL UNIQUE,       -- 内容 SHA-1，用于去重
    size        INTEGER NOT NULL,
    width       INTEGER NOT NULL DEFAULT 0,
    height      INTEGER NOT NULL DEFAULT 0,
    format      TEXT    NOT NULL DEFAULT '',
    taken_at    INTEGER NOT NULL,
    added_at    INTEGER NOT NULL,
    thumb       TEXT,
    dup_group   INTEGER                        -- 相似图片分组，NULL 表示无相似图
  );
  -- 两个排序索引与 keyset 分页的 (列, id) 比较完全匹配，翻到多深都是 O(limit)
  CREATE INDEX idx_images_taken ON images (taken_at DESC, id DESC);
  CREATE INDEX idx_images_added ON images (added_at DESC, id DESC);
  CREATE INDEX idx_images_dup   ON images (dup_group) WHERE dup_group IS NOT NULL;

  CREATE TABLE tags (
    id   INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
  );
  CREATE TABLE image_tags (
    image_id INTEGER NOT NULL REFERENCES images (id) ON DELETE CASCADE,
    tag_id   INTEGER NOT NULL REFERENCES tags (id)   ON DELETE CASCADE,
    PRIMARY KEY (image_id, tag_id)
  ) WITHOUT ROWID;
  CREATE INDEX idx_image_tags_tag ON image_tags (tag_id, image_id);

  CREATE TABLE watchers (
    path TEXT PRIMARY KEY,
    mode TEXT NOT NULL
  );

  -- 文件名全文索引：trigram 分词支持中文和任意子串匹配（查询词需 >= 3 个字符）
  CREATE VIRTUAL TABLE images_fts USING fts5 (
    name, content = 'images', content_rowid = 'id', tokenize = 'trigram'
  );
  CREATE TRIGGER images_ai AFTER INSERT ON images BEGIN
    INSERT INTO images_fts (rowid, name) VALUES (new.id, new.name);
  END;
  CREATE TRIGGER images_ad AFTER DELETE ON images BEGIN
    INSERT INTO images_fts (images_fts, rowid, name) VALUES ('delete', old.id, old.name);
  END;
  CREATE TRIGGER images_au AFTER UPDATE OF name ON images BEGIN
    INSERT INTO images_fts (images_fts, rowid, name) VALUES ('delete', old.id, old.name);
    INSERT INTO images_fts (rowid, name) VALUES (new.id, new.name);
  END;
  `;
