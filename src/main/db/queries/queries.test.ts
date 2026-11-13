import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterClause, RECENT_DAYS } from "./filter";
import { escapeLike, ftsPhrase, normalizeQuery, searchClause, useFts } from "./search";
import { DAY, ruleClause, ruleTags } from "./smartRule";
import { resolveSort } from "./sort";

const NOW = 1_700_000_000_000;

describe("filterClause", () => {
  const none = (): null => null;
  it("固定分类", () => {
    assert.deepEqual(filterClause("all", none, NOW), { sql: "1", params: [] });
    assert.deepEqual(filterClause("recent", none, NOW), {
      sql: "added_at >= ?",
      params: [NOW - RECENT_DAYS * DAY],
    });
    assert.equal(filterClause("duplicate", none)?.sql, "dup_group IS NOT NULL");
    assert.equal(filterClause("favorites", none)?.sql, "is_favorite = 1");
  });
  it("文件夹和标签用参数绑定", () => {
    assert.deepEqual(filterClause("folder:/a/b", none)?.params, ["/a/b"]);
    assert.deepEqual(filterClause("tag:风景", none)?.params, ["风景"]);
  });
  it("智能分类：规则查不到 / id 非法返回 null", () => {
    assert.equal(filterClause("smart:abc", none), null);
    assert.equal(filterClause("smart:3", none), null);
    assert.deepEqual(filterClause("smart:3", () => ({ favorite: true }))?.sql, "is_favorite = 1");
  });
  it("不认识的 filter 返回 null（不会悄悄显示全部）", () => {
    assert.equal(filterClause("whatever", none), null);
    assert.equal(filterClause(42, none), null);
  });
});

describe("ruleClause / ruleTags", () => {
  it("没有条件时恒真", () => {
    assert.deepEqual(ruleClause({}, NOW), { sql: "1", params: [] });
  });
  it("多个条件取交集", () => {
    const c = ruleClause({ days: 2, minSizeMB: 1, favorite: true, tags: ["a"] }, NOW);
    assert.equal(c.sql.split(" AND ").length, 4);
    assert.deepEqual(c.params, [NOW - 2 * DAY, JSON.stringify(["a"]), 1024 * 1024]);
  });
  it("兼容旧规则的单个 tag，并去重", () => {
    assert.deepEqual(ruleTags({ tags: ["a", "b"], tag: "a" }), ["a", "b"]);
    assert.deepEqual(ruleTags({ tag: "x" }), ["x"]);
  });
});

describe("search", () => {
  it("规整搜索词", () => {
    assert.equal(normalizeQuery("  hi  "), "hi");
    assert.equal(normalizeQuery("x".repeat(500)).length, 200);
    assert.equal(normalizeQuery(null), "");
  });
  it("LIKE 通配符转义，FTS 当短语", () => {
    assert.equal(escapeLike("50%_a\\"), "50\\%\\_a\\\\");
    assert.equal(ftsPhrase('a"b'), '"a""b"');
  });
  it("≥3 个字符走 FTS，否则 LIKE", () => {
    assert.ok(useFts("abc"));
    assert.ok(!useFts("ab"));
    assert.ok(searchClause("abc", []).sql.includes("images_fts"));
    assert.ok(searchClause("ab", []).sql.includes("LIKE"));
  });
  it("标签命中时做并集", () => {
    const c = searchClause("abc", [1, 2]);
    assert.ok(c.sql.includes("UNION"));
    assert.deepEqual(c.params, ['"abc"', "[1,2]"]);
  });
});

describe("resolveSort", () => {
  it("默认：拍摄时间从新到旧；最近导入按导入时间", () => {
    assert.equal(resolveSort("all", null).by, "taken");
    assert.equal(resolveSort("recent", null).by, "added");
    assert.equal(resolveSort("all", null).order, "DESC");
  });
  it("白名单：非法列回退默认，不会进入 SQL", () => {
    assert.equal(resolveSort("all", { by: "name; DROP TABLE images" as never }).expr, "taken_at");
  });
  it("升序的游标比较符是 >", () => {
    const s = resolveSort("all", { by: "name", dir: "asc" });
    assert.equal(s.cmp, ">");
    assert.equal(s.numeric, false);
  });
});
