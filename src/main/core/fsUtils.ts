// 文件系统小工具（同步的“是不是”判断 + 路径关系 + 异步探测）。
import fs from "node:fs";
import path from "node:path";
import { IMAGE_EXTS } from "@shared/constants";

export function isDirectory(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** 普通文件，不是快捷方式 / 符号链接（删除、移动前的安全检查） */
export function isRegularFile(p: string): boolean {
  try {
    const s = fs.lstatSync(p);
    return s.isFile() && !s.isSymbolicLink();
  } catch {
    return false;
  }
}

/** 路径上有东西（包括符号链接本身） */
export function exists(p: string): boolean {
  try {
    fs.lstatSync(p);
    return true;
  } catch {
    return false;
  }
}

/** child 是否等于 root，或在 root 里面 */
export function isInside(root: string, child: string): boolean {
  const rel = path.relative(root, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/** p 是否在 root 里面（先解析真实路径，防止通过快捷方式 / 符号链接指到目录外） */
export function isInsideReal(root: string, p: string): boolean {
  try {
    return isInside(fs.realpathSync(root), fs.realpathSync(p));
  } catch {
    return false;
  }
}

const IMAGE_EXT_SET: ReadonlySet<string> = new Set(IMAGE_EXTS);

/** 按扩展名判断是不是支持的图片 */
export const isImage = (file: string): boolean =>
  IMAGE_EXT_SET.has(path.extname(file).toLowerCase());

export type Probe = "yes" | "no" | "unknown";

/**
 * 'yes' 存在；'no' 确认不存在（ENOENT / ENOTDIR）；
 * 'unknown' 其他错误（没权限、磁盘出错等），一律当作“不知道”，不算丢失
 */
export async function probe(p: string): Promise<Probe> {
  try {
    await fs.promises.stat(p);
    return "yes";
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    return code === "ENOENT" || code === "ENOTDIR" ? "no" : "unknown";
  }
}
