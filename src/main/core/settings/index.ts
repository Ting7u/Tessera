// 极简设置存储：一个 JSON 文件；读不到或文件损坏就当空设置。
import fs from "node:fs";
import type { ImportMode } from "@shared/types";
import { createLogger } from "../logger";

const log = createLogger("settings");

/** 下载中的 .part 临时文件登记（p：路径，t：登记时间） */
export interface PartialEntry {
  p: string;
  t: number;
}

/** settings.json 里有哪些键。文件内容来自磁盘，读取处仍要自己校验类型 */
export interface SettingsSchema {
  importMode?: ImportMode;
  downloadDir?: string;
  /** 浏览器扩展令牌：扩展 Origin → 令牌 */
  bridgeTokens?: Record<string, string>;
  partials?: PartialEntry[];
}

export interface Settings {
  get<K extends keyof SettingsSchema>(key: K): SettingsSchema[K];
  set<K extends keyof SettingsSchema>(key: K, value: SettingsSchema[K]): void;
}

export function createSettings(file: string): Settings {
  let data: SettingsSchema = {};
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
    if (parsed && typeof parsed === "object") data = parsed as SettingsSchema; // 键的类型由读取处校验
  } catch {
    /* 首次启动没有文件，或文件损坏 */
  }

  return {
    get: (key) => data[key],
    set: (key, value) => {
      data[key] = value;
      try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
      } catch (err) {
        log.error("save failed:", err); // 写盘失败时本次运行内仍然生效
      }
    },
  };
}

/** 入库方式：只认 "copy"，其他一律按引用 */
export function readImportMode(settings: Settings): ImportMode {
  return settings.get("importMode") === "copy" ? "copy" : "reference";
}
