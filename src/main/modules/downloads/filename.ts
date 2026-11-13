// 下载文件名规则（纯函数，可单元测试）：由链接和返回类型决定落盘文件名。
import path from "node:path";
import { IMAGE_EXTS } from "@shared/constants";

// 返回的图片类型 → 可用的扩展名（第一个是默认值）
const MIME_EXTS: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/jpg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/gif": [".gif"],
  "image/webp": [".webp"],
  "image/bmp": [".bmp"],
  "image/x-ms-bmp": [".bmp"],
  "image/tiff": [".tif", ".tiff"],
  "image/avif": [".avif"],
  "image/heic": [".heic"],
  "image/heif": [".heif", ".heic"],
};
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const IMAGE_EXT_SET: ReadonlySet<string> = new Set(IMAGE_EXTS);

/** 优先相信服务器返回的类型；类型不认识（RAW 等）时才看链接里的扩展名 */
export function pickExt(urlExt: string, mime: string): string {
  const known = Object.hasOwn(MIME_EXTS, mime) ? MIME_EXTS[mime] : undefined;
  if (known) return known.includes(urlExt) ? urlExt : known[0];
  return IMAGE_EXT_SET.has(urlExt) ? urlExt : "";
}

/** 由链接和返回类型决定落盘文件名；既不是图片扩展名也不是图片类型时返回 null */
export function pickName(url: string, mime: string, now: number = Date.now()): string | null {
  let base = "";
  try {
    base = decodeURIComponent(path.basename(new URL(url).pathname));
  } catch {
    /* 当作没有文件名 */
  }
  const parsed = path.parse(base);
  const ext = pickExt(parsed.ext.toLowerCase(), mime);
  if (!ext) return null;
  let name = parsed.name
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, "_")
    .replace(/^[. ]+|[. ]+$/g, "") // 开头的点会变成隐藏文件（监听器会忽略），结尾的点/空格在 Windows 上非法
    .slice(0, 100);
  if (!name || WINDOWS_RESERVED.test(name)) name = `image-${now}`;
  return name + ext;
}

/** 目标目录里不重名的路径：name.jpg → name (1).jpg → name (2).jpg…；isTaken 决定哪些路径已被占用 */
export function uniquePath(dir: string, fileName: string, isTaken: (p: string) => boolean): string {
  const { name, ext } = path.parse(fileName);
  let dest = path.join(dir, fileName);
  for (let i = 1; isTaken(dest); i++) dest = path.join(dir, `${name} (${i})${ext}`);
  return dest;
}
