import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
/*
  assert：断言工具。strict 版本比较时更严格（比如 1 和 "1" 不会被当成相等）。
  describe：给一组测试起个名字，分组用。
  it：一条具体的测试用例。
  beforeEach：每个用例开始前先执行一次的准备动作。

  assert.deepEqual(实际值, 预期值);  // 两个值"内容"相同就通过（数组、对象逐项比较）
  assert.equal(实际值, 预期值);      // 严格相等
 */
import type { ViewItem } from "../shared/lib/toViewItem";
import {
  clearItemCache,
  getCachedItem,
  patchCachedItem,
  remember,
  replaceTagInCache,
  swapTag,
} from "./itemCache";

// 只填测试用到的字段，其余用断言绕过类型（测试里造完整的 ViewItem 没有意义）
const item = (id: number, tags: string[]): ViewItem => ({ id, tags, favorite: false }) as ViewItem;

describe("swapTag", () => {
  it("重命名：替换并去重（合并到已有标签时不出现两个同名）", () => {
    assert.deepEqual(swapTag(["a", "b"], "a", "c"), ["c", "b"]);
    assert.deepEqual(swapTag(["a", "b"], "a", "b"), ["b"]);
  });
  it("删除: to 为 null", () => {
    assert.deepEqual(swapTag(["a", "b"], "a", null), ["b"]);
  });
});

describe("itemCache", () => {
  beforeEach(() => clearItemCache());

  it("remember 返回原数组，可以按 id 取回", () => {
    const list = [item(1, ["x"])];
    assert.equal(remember(list), list);
    assert.equal(getCachedItem(1)?.id, 1);
    assert.equal(getCachedItem(2), undefined);
  });
  it("patchCachedItem 只改缓存里有的图片", () => {
    remember([item(1, [])]);
    patchCachedItem(1, { favorite: true });
    patchCachedItem(99, { favorite: true });
    assert.equal(getCachedItem(1)?.favorite, true);
    assert.equal(getCachedItem(99), undefined);
  });
  it("replaceTagInCache 同步缓存里所有带这个标签的图片", () => {
    remember([item(1, ["a", "b"]), item(2, ["b"])]);
    replaceTagInCache("a", "z");
    replaceTagInCache("b", null);
    assert.deepEqual(getCachedItem(1)?.tags, ["z"]);
    assert.deepEqual(getCachedItem(2)?.tags, []);
  });
});
