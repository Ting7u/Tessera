import fs from "node:fs";
import path from "node:path";
import { isImage } from "../../core/fsUtils";

/** 把用户选的文件 / 文件夹展开成图片文件列表（递归，跳过隐藏文件） */
export async function collectImages(inputs: string[]): Promise<string[]> {
  const out: string[] = [];
  async function walk(p: string): Promise<void> {
    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(p);
    } catch {
      return;
    }
    if (stat.isDirectory()) {
      const entries = await fs.promises.readdir(p, { withFileTypes: true });
      for (const e of entries) {
        if (e.name.startsWith(".")) continue;
        await walk(path.join(p, e.name));
      }
    } else if (isImage(p)) {
      out.push(p);
    }
  }
  for (const input of inputs) await walk(input);
  return out;
}
