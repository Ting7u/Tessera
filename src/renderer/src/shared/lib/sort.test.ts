import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SORT_KEYS, resolveSort, sortInfo } from "./sort";

describe("resolveSort", () => {
  it("没有手动选过时：最近导入按导入时间，其余按拍摄时间，都是新的在前", () => {
    assert.deepEqual(resolveSort("recent", null), { by: "added", dir: "desc" });
    assert.deepEqual(resolveSort("all", null), { by: "taken", dir: "desc" });
    assert.deepEqual(resolveSort("tag:风景", null), { by: "taken", dir: "desc" });
  });

  it("手动选过就用选的", () => {
    assert.deepEqual(resolveSort("recent", { by: "name", dir: "asc" }), { by: "name", dir: "asc" });
  });
});

describe("sortInfo", () => {
  it("每个排序依据的默认顺序是它的第一个可选顺序", () => {
    for (const k of SORT_KEYS) assert.equal(k.dirs[0], k.defaultDir);
  });
  it("文件名默认从 A 到 Z", () => {
    assert.equal(sortInfo("name").defaultDir, "asc");
  });
});
