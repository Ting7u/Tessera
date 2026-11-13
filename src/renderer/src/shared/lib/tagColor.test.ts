import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tagHue, tagStyle } from "./tagColor";

describe("tagHue", () => {
  it("同名同色，范围在 0–359", () => {
    assert.equal(tagHue("风景"), tagHue("风景"));
    for (const name of ["", "a", "风景", "😀", "x".repeat(100)]) {
      const h = tagHue(name);
      assert.ok(Number.isInteger(h) && h >= 0 && h < 360, name);
    }
  });
  it("不同名字大概率不同色", () => {
    const hues = new Set(["风景", "旅行", "日常", "灵感", "收藏"].map(tagHue));
    assert.ok(hues.size >= 4);
  });
  it("tagStyle 只输出 --tag-h", () => {
    assert.deepEqual(tagStyle("风景"), { "--tag-h": tagHue("风景") });
  });
});
