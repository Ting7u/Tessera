import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeLayout, parseLayout, visibleBoxes, DEFAULT_LAYOUT } from "./layout";

const items = (ratios: number[]) => ratios.map((ratio) => ({ ratio }));

describe("computeLayout", () => {
  it("空列表：没有位置框，高度为 0", () => {
    for (const mode of ["masonry", "grid", "rows"] as const) {
      const r = computeLayout([], 800, mode, "medium");
      assert.deepEqual(r.boxes, []);
      assert.equal(r.height, 0);
    }
  });

  it("每张图都有一个位置框，下标按顺序，且 boxes 按 y 不降", () => {
    const list = items([0.75, 1, 1.5, 0.5, 2, 1, 1.33, 0.9, 1.1, 0.7]);
    for (const mode of ["masonry", "grid", "rows"] as const) {
      const { boxes } = computeLayout(list, 900, mode, "medium");
      assert.equal(boxes.length, list.length);
      assert.deepEqual(
        boxes.map((b) => b.i).sort((a, b) => a - b),
        list.map((_, i) => i),
      );
      for (let k = 1; k < boxes.length; k++) assert.ok(boxes[k].y >= boxes[k - 1].y, mode);
    }
  });

  it("瀑布流：所有框都在容器宽度以内", () => {
    const { boxes } = computeLayout(items([1, 1.5, 0.7, 1.2, 0.9]), 1000, "masonry", "medium");
    for (const b of boxes) assert.ok(b.x >= 0 && b.x + b.w <= 1000 + 1e-6);
  });

  it("网格：格子是正方形，列数随宽度变化", () => {
    const narrow = computeLayout(items([1, 1, 1, 1]), 200, "grid", "medium");
    assert.equal(narrow.boxes[0].w, narrow.boxes[0].h);
    assert.equal(narrow.boxes[1].y > 0, true); // 200px 只放得下 1 列
    const wide = computeLayout(items([1, 1, 1, 1]), 1000, "grid", "medium");
    assert.equal(wide.boxes[1].y, 0); // 宽了就在同一行
  });

  it("对齐行：放满的行刚好铺满容器宽度", () => {
    const width = 1000;
    const { boxes } = computeLayout(
      items(new Array<number>(30).fill(1.5)),
      width,
      "rows",
      "medium",
    );
    const firstRow = boxes.filter((b) => b.y === 0);
    const last = firstRow[firstRow.length - 1];
    assert.ok(Math.abs(last.x + last.w - width) < 1e-6);
  });

  it("ratio 无效（0、负数）按 1 处理，不会产生 NaN", () => {
    const { boxes, height } = computeLayout(items([0, -1]), 600, "masonry", "small");
    for (const b of boxes) assert.ok(Number.isFinite(b.h) && b.h > 0);
    assert.ok(Number.isFinite(height));
  });
});

describe("visibleBoxes", () => {
  const layout = computeLayout(items(new Array<number>(200).fill(1)), 800, "grid", "medium");

  it("只返回与范围有重叠的框", () => {
    const top = 1000;
    const bottom = 1400;
    const visible = visibleBoxes(layout, top, bottom);
    assert.ok(visible.length > 0 && visible.length < layout.boxes.length);
    for (const b of visible) assert.ok(b.y <= bottom && b.y + b.h >= top);
  });

  it("结果和暴力过滤一致", () => {
    const expected = layout.boxes.filter((b) => b.y <= 1400 && b.y + b.h >= 1000);
    assert.deepEqual(visibleBoxes(layout, 1000, 1400), expected);
  });
});

describe("parseLayout", () => {
  it("合法数据原样返回，非法数据返回 null", () => {
    assert.deepEqual(parseLayout({ mode: "rows", size: "large" }), { mode: "rows", size: "large" });
    assert.equal(parseLayout({ mode: "nope", size: "large" }), null);
    assert.equal(parseLayout(null), null);
    assert.equal(parseLayout("masonry"), null);
    assert.deepEqual(DEFAULT_LAYOUT, { mode: "masonry", size: "medium" });
  });
});
