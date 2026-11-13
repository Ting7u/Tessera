import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { groupSimilar, popcount32 } from "./grouping";

describe("popcount32", () => {
  it("数 1 的个数", () => {
    assert.equal(popcount32(0), 0);
    assert.equal(popcount32(0xffffffff), 32);
    assert.equal(popcount32(0b1011), 3);
  });
});

describe("groupSimilar", () => {
  it("相差 ≤4 位归为一组，组号取最小 id", () => {
    const groups = groupSimilar([
      { id: 5, phash: "00000000000000ff" },
      { id: 2, phash: "00000000000000f7" }, // 与 5 相差 1 位
      { id: 9, phash: "ffffffff00000000" }, // 完全不同
    ]);
    assert.equal(groups.get(5), 2);
    assert.equal(groups.get(2), 2);
    assert.equal(groups.has(9), false);
  });
  it("相差超过 4 位不归组", () => {
    const groups = groupSimilar([
      { id: 1, phash: "0000000000000000" },
      { id: 2, phash: "000000000000001f" }, // 5 位
    ]);
    assert.equal(groups.size, 0);
  });
  it("传递：A~B、B~C 则三张同组", () => {
    const groups = groupSimilar([
      { id: 1, phash: "0000000000000000" },
      { id: 2, phash: "000000000000000f" }, // 与 1 相差 4
      { id: 3, phash: "00000000000000ff" }, // 与 2 相差 4，与 1 相差 8
    ]);
    assert.deepEqual([groups.get(1), groups.get(2), groups.get(3)], [1, 1, 1]);
  });
  it("空输入", () => {
    assert.equal(groupSimilar([]).size, 0);
  });
});
