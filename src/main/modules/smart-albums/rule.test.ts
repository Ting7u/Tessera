import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cleanRule } from "./rule";

describe("cleanRule", () => {
  it("非对象得到空规则", () => {
    assert.deepEqual(cleanRule(null), { days: 0, tags: [], minSizeMB: 0, favorite: false });
  });
  it("范围限制", () => {
    const r = cleanRule({ days: 99999, minSizeMB: -5, favorite: 1 });
    assert.equal(r.days, 3650);
    assert.equal(r.minSizeMB, 0);
    assert.equal(r.favorite, true);
  });
  it("标签：字符串按分隔符拆分、去重、兼容旧的 tag 字段、最多 20 个", () => {
    assert.deepEqual(cleanRule({ tags: "a, b；a", tag: "c" }).tags, ["a", "b", "c"]);
    const many = Array.from({ length: 30 }, (_, i) => `t${i}`);
    assert.equal(cleanRule({ tags: many }).tags.length, 20);
  });
});
