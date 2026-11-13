import crypto from "node:crypto";
import fs from "node:fs";

/** 文件内容的 SHA-1（十六进制）：内容相同、名字不同的图片靠它去重，缩略图也以它命名 */
export function hashFile(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash("sha1");
    fs.createReadStream(file)
      .on("data", (chunk) => h.update(chunk))
      .on("error", reject)
      .on("end", () => resolve(h.digest("hex")));
  });
}
