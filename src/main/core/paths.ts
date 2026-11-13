// 磁盘路径的“形状”。具体值由 app/paths.ts 计算（唯一出处），再注入到各模块。
export interface AppPaths {
  /** Electron 的 userData 目录（由 package.json 的 productName 决定，不要改名） */
  userData: string;
  /** SQLite 数据库 */
  db: string;
  /** 旧版 JSON 存储，首次启动自动迁移 */
  legacyJson: string;
  /** 缩略图目录：<sha1>.jpg */
  thumbs: string;
  /** “复制到图库托管”的目标目录 */
  library: string;
  /** 用户设置 */
  settings: string;
  /** 语言偏好（单独存放：启动时图库还没初始化就要读） */
  language: string;
}
