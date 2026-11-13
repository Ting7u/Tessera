import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeResult } from "./describeResult";

describe("describeResult", () => {
  it("取消", () => {
    assert.equal(describeResult({ canceled: true }), "已取消下载");
    assert.equal(describeResult({ canceled: true, added: 2 }), "已取消下载（已保存 2 张）");
  });
  it("组合结果", () => {
    assert.equal(
      describeResult({
        canceled: false,
        dir: "/p",
        added: 2,
        skipped: 1,
        failed: 1,
        reason: "超时",
      }),
      "已保存 2 张到 /p，跳过重复 1 张，失败 1 张（超时）",
    );
  });
  it("什么都没有", () => {
    assert.equal(describeResult({ canceled: false }), "没有可下载的图片");
  });
});
