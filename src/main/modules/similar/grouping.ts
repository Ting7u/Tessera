// 相似图片分组（纯函数）：哈希相差不超过 MAX_DISTANCE 位的归为一组。
// 它能识别“同一张图的缩放 / 重新压缩 / 轻微调色”，不是按内容语义找“风格相近的图”。

export const MAX_DISTANCE = 4; // 调大更宽松（漏检少、误判多），调小更严格
const MAX_BUCKET = 300; // 同一个分段下的图片过多说明哈希已经退化，跳过以避免 O(n²)

interface Item {
  id: number;
  hi: number;
  lo: number;
}

export function popcount32(value: number): number {
  let x = value >>> 0;
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  x = (x + (x >>> 4)) & 0x0f0f0f0f;
  return Math.imul(x, 0x01010101) >>> 24;
}

/**
 * 把 64 位切成 5 段（13/13/13/13/12 位）。两个哈希相差 ≤4 位时，至少有一段完全相同（鸽巢原理），
 * 只需要比较“同一段值相同”的图片，不用两两比较全部
 */
function chunks(h: { hi: number; lo: number }): number[] {
  return [
    h.lo & 0x1fff,
    (h.lo >>> 13) & 0x1fff,
    ((h.lo >>> 26) | (h.hi << 6)) & 0x1fff,
    (h.hi >>> 7) & 0x1fff,
    (h.hi >>> 20) & 0xfff,
  ];
}

/** rows: [{ id, phash }] → Map(id → 组号)。组号取组内最小 id，只包含 ≥2 张的组 */
export function groupSimilar(rows: { id: number; phash: string }[]): Map<number, number> {
  const items: Item[] = rows.map((r) => ({
    id: r.id,
    hi: parseInt(r.phash.slice(0, 8), 16),
    lo: parseInt(r.phash.slice(8), 16),
  }));
  const parent = items.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };

  const buckets = new Map<number, number[]>();
  items.forEach((item, i) => {
    chunks(item).forEach((c, k) => {
      const key = k * 65536 + c;
      const list = buckets.get(key);
      if (list) list.push(i);
      else buckets.set(key, [i]);
    });
  });
  for (const list of buckets.values()) {
    if (list.length < 2 || list.length > MAX_BUCKET) continue;
    for (let a = 0; a < list.length; a++) {
      for (let b = a + 1; b < list.length; b++) {
        const x = items[list[a]];
        const y = items[list[b]];
        if (popcount32(x.hi ^ y.hi) + popcount32(x.lo ^ y.lo) <= MAX_DISTANCE) {
          parent[find(list[a])] = find(list[b]);
        }
      }
    }
  }

  const comps = new Map<number, { min: number; size: number }>(); // 根 → { min, size }
  items.forEach((item, i) => {
    const root = find(i);
    const c = comps.get(root);
    if (c) {
      c.min = Math.min(c.min, item.id);
      c.size++;
    } else {
      comps.set(root, { min: item.id, size: 1 });
    }
  });
  const result = new Map<number, number>();
  items.forEach((item, i) => {
    const c = comps.get(find(i));
    if (c && c.size >= 2) result.set(item.id, c.min);
  });
  return result;
}
