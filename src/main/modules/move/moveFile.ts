// 移动单个文件，保证绝不覆盖已有文件。
import fs from "node:fs";
import path from "node:path";
import { exists } from "../../core/fsUtils";

const fsp = fs.promises;

async function copyThenDelete(src: string, dest: string): Promise<void> {
  await fsp.copyFile(src, dest, fs.constants.COPYFILE_EXCL);
  try {
    const [a, b] = await Promise.all([fsp.stat(src), fsp.stat(dest)]);
    if (a.size !== b.size) throw new Error("复制后文件大小不一致");
    await fsp.unlink(src);
  } catch (err) {
    await fsp.unlink(dest).catch(() => {}); // 只撤销我们刚创建的目标文件
    throw err;
  }
}

/**
 * 把 src 移到 dest，保证绝不覆盖已有文件（rename 在 Windows / Linux 上会悄悄覆盖同名文件，所以不用它）：
 *   1. 先试“硬链接 + 删原文件”：同一个磁盘上瞬间完成，目标已存在时会报错而不是覆盖
 *   2. 链接不行（跨磁盘、exFAT / 网络盘不支持）就“复制 + 核对大小 + 删原文件”，复制同样不覆盖
 * 任何一步失败都会撤销已经做的部分，原文件保持原样
 */
export async function moveNoOverwrite(src: string, dest: string): Promise<void> {
  try {
    await fsp.link(src, dest);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EEXIST") throw err;
    return copyThenDelete(src, dest); // 跨磁盘、文件系统不支持链接等
  }
  try {
    await fsp.unlink(src);
  } catch (err) {
    await fsp.unlink(dest).catch(() => {}); // 原文件删不掉（被占用 / 只读）：撤销，保持原状
    throw err;
  }
}

/** 目标文件夹里的不重名路径：name.jpg → name (1).jpg → name (2).jpg…；磁盘上有或图库里记过的路径都算已占用 */
export function uniqueDest(dir: string, name: string, isTaken: (p: string) => boolean): string {
  const { name: base, ext } = path.parse(name);
  for (let n = 0; n < 10000; n++) {
    const candidate = path.join(dir, n === 0 ? name : `${base} (${n})${ext}`);
    if (!exists(candidate) && !isTaken(candidate)) return candidate;
  }
  throw new Error("目标文件夹里重名文件太多");
}
