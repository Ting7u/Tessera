import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { format, translate } from "./translate";

describe("format", () => {
  it("替换占位符，缺参数时保留原样", () => {
    assert.equal(format("你好，{name}", { name: "张三" }), "你好，张三");
    assert.equal(format("你好，{name}", {}), "你好，{name}");
  });
});

describe("translate", () => {
  it("找不到的键返回键名，并触发 onMissing", () => {
    let missing = "";
    assert.equal(translate("zh", "no.such.key", undefined, (k) => (missing = k)), "no.such.key");
    assert.equal(missing, "no.such.key");
  });
});
