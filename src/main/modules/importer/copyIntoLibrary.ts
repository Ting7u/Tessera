import fs from "node:fs";
import path from "node:path";

/** 复制到图库目录：<library>/<YYYY-MM>/<原文件名>，重名则追加哈希前缀。返回副本路径 */
export async function copyIntoLibrary(
  file: string,
  stat: { mtimeMs: number },
  hash: string,
  libraryDir: string,
): Promise<string> {
  const d = new Date(stat.mtimeMs);
  const dir = path.join(
    libraryDir,
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
  ); // 月份从 0 开始
  await fs.promises.mkdir(dir, { recursive: true });
  const { name, ext } = path.parse(file);
  let dest = path.join(dir, name + ext);
  if (fs.existsSync(dest)) dest = path.join(dir, `${name}_${hash.slice(0, 6)}${ext}`);
  await fs.promises.copyFile(file, dest, fs.constants.COPYFILE_EXCL); // 不允许覆盖已有文件
  return dest;
}
