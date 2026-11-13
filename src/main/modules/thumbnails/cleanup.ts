import fs from "node:fs";
import path from "node:path";
import { isRegularFile } from "../../core/fsUtils";

/** 缩略图文件名 = 内容 SHA-1 + .jpg，只删符合这个格式的 */
export const THUMB_RE = /^[0-9a-f]{40}\.jpg$/;

/** 删除 Tessera 自己生成的缩略图：文件名必须符合格式，且是普通文件（不是快捷方式） */
export async function deleteThumbs(
  thumbsDir: string,
  rows: { thumb: string | null }[],
): Promise<void> {
  for (const r of rows) {
    if (!r.thumb || !THUMB_RE.test(r.thumb)) continue;
    const file = path.join(thumbsDir, r.thumb);
    if (isRegularFile(file)) await fs.promises.unlink(file).catch(() => {});
  }
}
