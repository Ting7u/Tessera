// v2：EXIF 字段。老数据 exif_done = 0，由后台任务补读
// 已发布的迁移永远不要修改，改表结构请追加新的版本。
export const v2 = `
  ALTER TABLE images ADD COLUMN camera         TEXT;
  ALTER TABLE images ADD COLUMN lens           TEXT;
  ALTER TABLE images ADD COLUMN iso            INTEGER;
  ALTER TABLE images ADD COLUMN aperture       REAL;     -- 光圈 f 值
  ALTER TABLE images ADD COLUMN shutter        REAL;     -- 快门，单位秒
  ALTER TABLE images ADD COLUMN focal_length   REAL;     -- 焦距 mm
  ALTER TABLE images ADD COLUMN gps_lat        REAL;
  ALTER TABLE images ADD COLUMN gps_lon        REAL;
  ALTER TABLE images ADD COLUMN orientation    INTEGER;
  ALTER TABLE images ADD COLUMN has_exif_date  INTEGER NOT NULL DEFAULT 0; -- taken_at 是否来自 EXIF（否则是文件修改时间）
  ALTER TABLE images ADD COLUMN exif_done      INTEGER NOT NULL DEFAULT 0;
  CREATE INDEX idx_images_exif_pending ON images (id) WHERE exif_done = 0;
  `;
