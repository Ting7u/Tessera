import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cleanIds, cleanTag, toId } from "./sanitize";

describe("toId", () => {
  it("只接受正整数", () => {
    assert.equal(toId(5), 5);
    assert.equal(toId("7"), 7);
    for (const bad of [0, -1, 1.5, NaN, "abc", null, undefined, Infinity])
      assert.equal(toId(bad), null);
  });
});

describe("cleanTag", () => {
  it("折叠空白、去首尾、最多 30 字", () => {
    assert.equal(cleanTag("  a   b\n c "), "a b c");
    assert.equal(cleanTag("x".repeat(50)).length, 30);
    assert.equal(cleanTag(null), "");
  });
});

describe("cleanIds", () => {
  it("去重、丢弃非法值、限制数量", () => {
    assert.deepEqual(cleanIds([1, "2", 2, 0, "x", 3], 10), [1, 2, 3]);
    assert.deepEqual(cleanIds([1, 2, 3, 4], 2), [1, 2]);
    assert.deepEqual(cleanIds("nope", 10), []);
  });
});
