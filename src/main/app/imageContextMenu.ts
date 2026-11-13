// 详情大图的右键菜单：另存为 / 复制图片 / 在文件夹中显示。
// 只对 tessera://original/<id> 生效；id 由主进程自己查路径，页面传不了任意文件路径。
import fs from "node:fs";
import path from "node:path";
import {
  clipboard,
  ClipboardItem,
  dialog,
  Menu,
  nativeImage,
  shell,
  type BrowserWindow,
} from "electron";
import { ORIGINAL_HOST, PROTOCOL_SCHEME } from "@shared/protocol";
import { t } from "../core/i18n";
import { loadSharp } from "../core/sharp";

const ORIGINAL_PREFIX = `${PROTOCOL_SCHEME}://${ORIGINAL_HOST}/`;

export function setupImageContextMenu(
  win: BrowserWindow,
  getImagePath: (id: number) => string | null,
): void {
  win.webContents.on("context-menu", (_event, params: { mediaType: string; srcURL: string }) => {
    if (params.mediaType !== "image" || !params.srcURL.startsWith(ORIGINAL_PREFIX)) return;

    const id = Number(path.basename(new URL(params.srcURL).pathname));
    const file = Number.isInteger(id) ? getImagePath(id) : null;
    if (!file) return;

    const saveAs = async (): Promise<void> => {
      const ext = path.extname(file).slice(1);
      const { canceled, filePath } = await dialog.showSaveDialog(win, {
        defaultPath: path.basename(file),
        filters: ext
          ? [
              { name: t("dialog.filter.images"), extensions: [ext] },
              { name: t("dialog.filter.all"), extensions: ["*"] },
            ]
          : undefined,
      });
      if (canceled || !filePath) return;
      try {
        await fs.promises.copyFile(file, filePath);
      } catch (err) {
        dialog.showErrorBox(t("error.saveAsFailed"), (err as Error).message);
      }
    };

    const copyImage = async (): Promise<void> => {
      let image = nativeImage.createFromPath(file);
      if (image.isEmpty()) {
        // nativeImage 不认的格式（WebP 等）：用 sharp 转成 PNG 再复制
        try {
          const sharp = await loadSharp();
          if (sharp) image = nativeImage.createFromBuffer(await sharp(file).png().toBuffer());
        } catch {
          /* 下面统一报错 */
        }
      }
      if (image.isEmpty()) {
        dialog.showErrorBox(t("error.copyFailed"), t("error.imageUnreadable"));
        return;
      }
      try {
        // Electron 45 起没有 clipboard.writeImage，用异步的 clipboard.write
        await clipboard.write([
          new ClipboardItem({
            "image/png": new Blob([new Uint8Array(image.toPNG())], { type: "image/png" }),
          }),
        ]);
      } catch (err) {
        dialog.showErrorBox(t("error.copyFailed"), (err as Error).message);
      }
    };

    Menu.buildFromTemplate([
      { label: t("menu.saveImageAs"), click: saveAs },
      { label: t("menu.copyImage"), click: copyImage },
      { type: "separator" },
      { label: t("menu.showInFolder"), click: () => shell.showItemInFolder(file) },
    ]).popup({ window: win });
  });
}
