import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { PART_RE, sweepPartials } from "./partials";

describe("PART_RE", () => {
  it("只匹配我们生成的格式", () => {
    assert.ok(PART_RE.test(".1700000000000-abc123.part"));
    assert.ok(!PART_RE.test("photo.part"));
    assert.ok(!PART_RE.test(".123-abc.part"));
  });
});

describe("sweepPartials", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tessera-part-"));

  it("删除自己登记的 .part，不碰格式不对的文件", () => {
    const mine = path.join(dir, ".1700000000000-abc.part");
    const other = path.join(dir, "keep.jpg");
    fs.writeFileSync(mine, "x");
    fs.writeFileSync(other, "x");
    const handled = sweepPartials([
      { p: mine, t: Date.now() },
      { p: other, t: Date.now() },
    ]);
    assert.equal(handled.length, 2);
    assert.ok(!fs.existsSync(mine));
    assert.ok(fs.existsSync(other));
  });

  it("文件早于登记时间的不是我们写的：不删，但不再记录", () => {
    const old = path.join(dir, ".1700000000001-old.part");
    fs.writeFileSync(old, "x");
    const handled = sweepPartials([{ p: old, t: Date.now() + 60_000 }]);
    assert.equal(handled.length, 1);
    assert.ok(fs.existsSync(old));
  });

  it("相对路径和乱七八糟的记录被丢弃", () => {
    assert.equal(sweepPartials([{ p: ".1700000000000-abc.part", t: 1 }, null, "x"]).length, 3);
  });
});
