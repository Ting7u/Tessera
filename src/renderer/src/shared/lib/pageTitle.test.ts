import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SidebarData } from "@shared/types";
import { getPageTitle } from "./pageTitle";

// 测试里用“把键名和参数拼起来”的翻译函数，只验证选了哪个键、传了什么参数
const t = (key: string, params?: Record<string, unknown>): string =>
  params ? `${key}:${JSON.stringify(params)}` : key;

const sidebar: SidebarData = {
  total: 0,
  recent: 0,
  duplicate: 0,
  favorites: 0,
  folders: [{ key: "folder:D:\\照片\\旅行", label: "旅行", path: "D:\\照片\\旅行", count: 1 }],
  tags: [],
  smart: [{ id: 3, key: "smart:3", name: "大图", count: 2 }],
};

describe("getPageTitle", () => {
  it("内置分类用 category.<id>", () => {
    assert.equal(getPageTitle(t, "all"), "category.all");
    assert.equal(getPageTitle(t, "favorites"), "category.favorites");
  });
  it("文件夹：优先用侧边栏里的名字，查不到就取路径最后一段（兼容 \\ 和 /）", () => {
    assert.equal(getPageTitle(t, "folder:D:\\照片\\旅行", sidebar), 'title.folder:{"name":"旅行"}');
    assert.equal(getPageTitle(t, "folder:/a/b/c"), 'title.folder:{"name":"c"}');
  });
  it("标签、智能分类", () => {
    assert.equal(getPageTitle(t, "tag:风景"), 'title.tag:{"name":"风景"}');
    assert.equal(getPageTitle(t, "smart:3", sidebar), 'title.smart:{"name":"大图"}');
    assert.equal(getPageTitle(t, "smart:9", sidebar), 'title.smart:{"name":""}');
  });
  it("不认识的 id 原样返回", () => {
    assert.equal(getPageTitle(t, "whatever"), "whatever");
  });
});
