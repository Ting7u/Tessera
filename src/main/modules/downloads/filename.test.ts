import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { pickExt, pickName, uniquePath } from "./filename";

describe("pickExt", () => {
  it("优先相信服务器返回的类型", () => {
    assert.equal(pickExt(".png", "image/jpeg"), ".jpg");
    assert.equal(pickExt(".jpeg", "image/jpeg"), ".jpeg");
  });
  it("类型不认识时看链接里的扩展名", () => {
    assert.equal(pickExt(".cr2", ""), ".cr2");
    assert.equal(pickExt(".txt", ""), "");
  });
});

describe("pickName", () => {
  it("取链接里的文件名", () => {
    assert.equal(pickName("https://a.com/x/cat.jpg?size=1", "image/jpeg"), "cat.jpg");
  });
  it("不是图片返回 null", () => {
    assert.equal(pickName("https://a.com/readme.txt", "text/plain"), null);
  });
  it("没有文件名或为 Windows 保留名时用 image-<时间>", () => {
    assert.equal(pickName("https://a.com/", "image/png", 123), "image-123.png");
    assert.equal(pickName("https://a.com/con.png", "image/png", 123), "image-123.png");
  });
  it("非法字符替换为下划线，开头的点去掉", () => {
    assert.equal(pickName("https://a.com/.hid%3Aden.png", "image/png"), "hid_den.png");
  });
  it("文件名最多 100 个字符", () => {
    const name = pickName(`https://a.com/${"a".repeat(300)}.png`, "image/png");
    assert.equal(name, `${"a".repeat(100)}.png`);
  });
});

describe("uniquePath", () => {
  it("重名时追加 (1)、(2)…", () => {
    const taken = new Set([path.join("d", "a.jpg"), path.join("d", "a (1).jpg")]);
    assert.equal(
      uniquePath("d", "a.jpg", (p) => taken.has(p)),
      path.join("d", "a (2).jpg"),
    );
    assert.equal(
      uniquePath("d", "b.jpg", (p) => taken.has(p)),
      path.join("d", "b.jpg"),
    );
  });
});
