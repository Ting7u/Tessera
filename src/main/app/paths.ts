// 所有磁盘路径的唯一出处。其他地方一律通过参数拿到 AppPaths，不要自己拼路径。
// 目录名由 package.json 的 productName 决定（userData），文件名是历史约定，都不能改：改了老用户就“丢库”。
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import type { AppPaths } from "../core/paths";

export function resolveAppPaths(userData: string = app.getPath("userData")): AppPaths {
  return {
    userData,
    db: path.join(userData, "library.db"),
    legacyJson: path.join(userData, "library.json"), // 旧版 JSON 存储，首次启动自动迁移
    thumbs: path.join(userData, "thumbs"),
    library: path.join(userData, "library"), // “复制到图库托管”的目标目录
    settings: path.join(userData, "settings.json"),
    language: path.join(userData, "language.json"),
  };
}

/** 确保运行时需要的目录存在 */
export function ensureAppDirs(paths: AppPaths): void {
  fs.mkdirSync(paths.thumbs, { recursive: true });
  fs.mkdirSync(paths.library, { recursive: true });
}
