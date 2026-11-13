// 图片布局：三种排法 + 虚拟列表需要的“看得见哪些”的计算。全是纯函数，不依赖 React。
//
// 每种布局的输入都是：图片列表（每张有 ratio = 宽/高）、容器宽度、布局方式、大小档位；
// 输出是每张图的位置和大小 { i: 在列表里的下标, x, y, w, h }，以及整体高度。
// 因为 ratio 在数据库里早就有了，不用等图片加载就能算出所有位置，所以可以只渲染屏幕附近的那几十张。
// 读写“记住的选择”（localStorage）在 layoutStorage.ts，这里保持纯。

export type LayoutMode = "masonry" | "grid" | "rows";
export type LayoutSize = "small" | "medium" | "large";

export interface LayoutChoice {
  mode: LayoutMode;
  size: LayoutSize;
}

/** 菜单里显示的名字不在这里：layout.mode.<key> 和 layout.size.<key> 在 locales 里 */
export const LAYOUTS: readonly { key: LayoutMode }[] = [
  { key: "masonry" },
  { key: "grid" },
  { key: "rows" },
];
export const SIZES: readonly { key: LayoutSize }[] = [
  { key: "small" },
  { key: "medium" },
  { key: "large" },
];

export const DEFAULT_LAYOUT: LayoutChoice = { mode: "masonry", size: "medium" };

/** 只要求有 ratio（宽/高）；ViewItem 满足它，测试里也不用造完整的图片 */
export interface Measurable {
  ratio: number;
}

/** 一张图的位置框 */
export interface Box {
  /** 在图片列表里的下标 */
  i: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutResult {
  /** 按 y 从小到大排好（三种布局天然满足），visibleBoxes 靠它做二分 */
  boxes: Box[];
  height: number;
  maxBoxHeight: number;
}

interface EngineResult {
  boxes: Box[];
  height: number;
}
type Engine = (items: readonly Measurable[], width: number, size: LayoutSize) => EngineResult;

// 每档大小对应的数值（像素）
const SIZE_PX: Record<LayoutMode, Record<LayoutSize, number>> = {
  masonry: { small: 160, medium: 220, large: 300 }, // 最小列宽（medium 和原来一样）
  grid: { small: 120, medium: 170, large: 240 }, // 格子最小边长
  rows: { small: 130, medium: 190, large: 270 }, // 目标行高
};
const GAP: Record<LayoutMode, number> = { masonry: 14, grid: 10, rows: 10 };
const MIN_TILE_HEIGHT = 112; // 瀑布流里卡片的最小高度，和 Tile.module.scss 里的 min-height 一致
const ROW_RATIO_MIN = 0.5; // 对齐行：太窄太宽的图按这个范围参与排版（超出的部分裁剪），免得一行挤几十张竖条
const ROW_RATIO_MAX = 2.5;

const ratioOf = (item: Measurable): number => (item.ratio > 0 ? item.ratio : 1);
const clampRatio = (item: Measurable): number =>
  Math.min(ROW_RATIO_MAX, Math.max(ROW_RATIO_MIN, ratioOf(item)));

const masonry: Engine = (items, width, size) => {
  const gap = GAP.masonry;
  const cols = Math.max(1, Math.floor((width + gap) / (SIZE_PX.masonry[size] + gap)));
  const colW = (width - gap * (cols - 1)) / cols;
  const heights: number[] = new Array<number>(cols).fill(0);
  const boxes: Box[] = [];
  for (let i = 0; i < items.length; i++) {
    // 放进当前最矮的一列（并列时取最左边，和原来的瀑布流一致）
    let c = 0;
    for (let k = 1; k < cols; k++) if (heights[k] < heights[c]) c = k;
    const h = Math.max(MIN_TILE_HEIGHT, colW / ratioOf(items[i]));
    boxes.push({ i, x: c * (colW + gap), y: heights[c], w: colW, h });
    heights[c] += h + gap;
  }
  return { boxes, height: items.length ? Math.max(...heights) - gap : 0 };
};

const grid: Engine = (items, width, size) => {
  const gap = GAP.grid;
  const cols = Math.max(1, Math.floor((width + gap) / (SIZE_PX.grid[size] + gap)));
  const cell = (width - gap * (cols - 1)) / cols;
  const boxes: Box[] = items.map((_, i) => ({
    i,
    x: (i % cols) * (cell + gap),
    y: Math.floor(i / cols) * (cell + gap),
    w: cell,
    h: cell,
  }));
  const rowCount = Math.ceil(items.length / cols);
  return { boxes, height: rowCount ? rowCount * (cell + gap) - gap : 0 };
};

// 对齐行：按目标行高一行行地放，放满就把这一行整体缩放到刚好铺满容器宽度；最后一行不拉伸
const rows: Engine = (items, width, size) => {
  const gap = GAP.rows;
  const target = SIZE_PX.rows[size];
  const boxes: Box[] = [];
  let y = 0;
  let start = 0;
  let sum = 0; // 当前行所有图的宽高比之和

  const flush = (end: number, justify: boolean): void => {
    const count = end - start + 1;
    const h = justify ? (width - gap * (count - 1)) / sum : target;
    let x = 0;
    for (let i = start; i <= end; i++) {
      const w = clampRatio(items[i]) * h;
      boxes.push({ i, x, y, w, h });
      x += w + gap;
    }
    y += h + gap;
    start = end + 1;
    sum = 0;
  };

  for (let i = 0; i < items.length; i++) {
    sum += clampRatio(items[i]);
    if (sum * target + gap * (i - start) >= width) flush(i, true);
  }
  if (start < items.length) flush(items.length - 1, false);
  return { boxes, height: boxes.length ? y - gap : 0 };
};

const ENGINES: Record<LayoutMode, Engine> = { masonry, grid, rows };

export function computeLayout(
  items: readonly Measurable[],
  width: number,
  mode: LayoutMode,
  size: LayoutSize,
): LayoutResult {
  const engine = ENGINES[mode] ?? masonry;
  const result = engine(items, width, SIZE_PX[mode] ? size : "medium");
  let maxBoxHeight = 0;
  for (const b of result.boxes) if (b.h > maxBoxHeight) maxBoxHeight = b.h;
  return { ...result, maxBoxHeight };
}

/** 与 [top, bottom] 这段纵向范围有重叠的所有位置框。二分找起点，只遍历看得见的那几十个 */
export function visibleBoxes(layout: LayoutResult, top: number, bottom: number): Box[] {
  const { boxes, maxBoxHeight } = layout;
  const from = top - maxBoxHeight;
  let lo = 0;
  let hi = boxes.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (boxes[mid].y < from) lo = mid + 1;
    else hi = mid;
  }
  const out: Box[] = [];
  for (let k = lo; k < boxes.length && boxes[k].y <= bottom; k++) {
    const b = boxes[k];
    if (b.y + b.h >= top) out.push(b);
  }
  return out;
}

/** 校验“外面来的”布局数据（localStorage 里读出来的），不合法返回 null */
export function parseLayout(value: unknown): LayoutChoice | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as { mode?: unknown; size?: unknown };
  const mode = LAYOUTS.find((l) => l.key === v.mode)?.key;
  const size = SIZES.find((s) => s.key === v.size)?.key;
  return mode && size ? { mode, size } : null;
}
