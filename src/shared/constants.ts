// 三个进程（main / preload / renderer）都需要知道的常量。
// 规则：shared 目录里只放类型、常量、纯函数，不能 import electron / node / react。

/** 软件显示名。改名时同时检查 package.json 的 productName（它决定用户数据目录，改名会让老用户“丢库”） */
export const APP_NAME = "Tessera";

/** 与 electron-builder.yml 里的 appId 一致 */
export const APP_ID = "com.tingyu.tessera";

/** 支持的图片扩展名（HEIC / RAW 能否生成缩略图取决于系统解码器，拿不到时只入库不出缩略图） */
export const IMAGE_EXTS = [
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tif", ".tiff",
  ".heic", ".heif", ".avif",
  ".cr2", ".cr3", ".nef", ".arw", ".dng", ".raf", ".orf", ".rw2",
] as const;

/**
 * 浏览器扩展桥接的本机端口范围。
 * extensions/browser/background.js 里有一份相同的 PORTS，改这里时必须同步修改（scripts/check-ipc.mjs 会检查）。
 */
export const BRIDGE_PORT_START = 38765;
export const BRIDGE_PORT_COUNT = 10;
