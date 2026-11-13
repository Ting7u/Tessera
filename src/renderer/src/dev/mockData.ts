// 浏览器单独调试用的模拟数据（原 src/data.js 的 placeholders 改成主进程的 ImageRecord 结构）。
// 没有真实缩略图（thumb 为 null），界面会显示按色相生成的渐变占位。
import type { ImageRecord } from "@shared/types";

const RATIOS = [0.75, 1, 1.33, 0.66, 1.5, 0.56, 1.78, 0.9];
const NAMES = [
  "山间晨雾",
  "海岸线",
  "夏日窗影",
  "雾中湖泊",
  "都市夜色",
  "旷野来信",
  "黄昏列车",
  "晴空之下",
  "绿野漫步",
  "旧街一隅",
  "远山如黛",
  "湖畔微光",
];
const TAG_SETS = [["风景", "旅行"], ["日常"], ["灵感", "收藏"]];

export const MOCK_FOLDERS = [
  { key: "folder:/mock/travel", label: "旅行记录", path: "/mock/travel", count: 238 },
  { key: "folder:/mock/assets", label: "设计素材", path: "/mock/assets", count: 1204 },
  { key: "folder:/mock/phone", label: "手机导入", path: "/mock/phone", count: 326 },
];

export function createMockRecords(): ImageRecord[] {
  return Array.from({ length: 48 }, (_, i): ImageRecord => {
    const ratio = RATIOS[(i * 5 + (i >> 2)) % RATIOS.length];
    const day = new Date(2026, 9 - (i % 4), 26 - (i % 18)).getTime();
    return {
      id: i + 1,
      name: `${NAMES[i % NAMES.length]}_${String(1001 + i).slice(-4)}.jpg`,
      path: `${MOCK_FOLDERS[i % MOCK_FOLDERS.length].path}/${i + 1}.jpg`,
      managed: false,
      size: Math.round((1.2 + (i % 12) * 0.43) * 1048576),
      width: 1200,
      height: Math.round(1200 / ratio),
      format: "JPEG",
      takenAt: day,
      addedAt: day + 3600_000,
      thumb: null,
      dupGroup: i === 4 || i === 16 || i === 29 ? 1 : null,
      favorite: false,
      camera: null,
      lens: null,
      iso: null,
      aperture: null,
      shutter: null,
      focalLength: null,
      gpsLat: null,
      gpsLon: null,
      orientation: null,
      hasExifDate: false,
      tags: [...TAG_SETS[i % TAG_SETS.length]],
    };
  });
}
