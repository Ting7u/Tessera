// dHash（差异哈希）：缩到 9×8 灰度，比较每行相邻像素，得 64 位。依赖 nativeImage，所以不放进纯函数文件。
import { nativeImage } from "electron";

/** 返回 16 位十六进制；"" 表示无法比较（解码失败 / 纯色图没有梯度） */
export function dhash(file: string): string {
  try {
    const img = nativeImage.createFromPath(file);
    if (img.isEmpty()) return "";
    const bmp = img.resize({ width: 9, height: 8, quality: "good" }).toBitmap();
    if (bmp.length < 9 * 8 * 4) return "";
    const gray = new Array<number>(72);
    for (let i = 0; i < 72; i++) {
      gray[i] = bmp[i * 4] * 0.114 + bmp[i * 4 + 1] * 0.587 + bmp[i * 4 + 2] * 0.299;
    }
    let hi = 0;
    let lo = 0;
    let bit = 0;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const on = gray[y * 9 + x] > gray[y * 9 + x + 1] ? 1 : 0;
        if (bit < 32) hi = ((hi << 1) | on) >>> 0;
        else lo = ((lo << 1) | on) >>> 0;
        bit++;
      }
    }
    if (hi === 0 && lo === 0) return ""; // 纯色图：哈希全相同，不参与比较
    return hi.toString(16).padStart(8, "0") + lo.toString(16).padStart(8, "0");
  } catch {
    return "";
  }
}
