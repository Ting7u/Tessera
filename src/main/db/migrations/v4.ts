// v4：按文件名、文件大小排序用的索引（升序降序共用，反向扫描即可）。文件名用 NOCASE：英文不区分大小写；中文按 Unicode 编码排序（不是拼音）
// 已发布的迁移永远不要修改，改表结构请追加新的版本。
export const v4 = `
  CREATE INDEX idx_images_name ON images (name COLLATE NOCASE, id);
  CREATE INDEX idx_images_size ON images (size, id);
  `;
