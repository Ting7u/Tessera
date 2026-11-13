import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { isImage, isInside, probe } from "./fsUtils";

describe("isInside", () => {
  it("自己和子路径算在里面，兄弟和上级不算", () => {
    const root = path.resolve("/a/b");
    assert.ok(isInside(root, root));
    assert.ok(isInside(root, path.join(root, "c", "d.jpg")));
    assert.ok(!isInside(root, path.resolve("/a/bc")));
    assert.ok(!isInside(root, path.resolve("/a")));
    assert.ok(!isInside(root, path.join(root, "..", "x")));
  });
});

describe("isImage", () => {
  it("按扩展名（不分大小写）", () => {
    assert.ok(isImage("/x/A.JPG"));
    assert.ok(isImage("b.cr3"));
    assert.ok(!isImage("c.txt"));
  });
});

describe("probe", () => {
  it("存在 / 不存在 / ENOTDIR", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tessera-probe-"));
    const file = path.join(dir, "f");
    fs.writeFileSync(file, "x");
    assert.equal(await probe(file), "yes");
    assert.equal(await probe(path.join(dir, "nope")), "no");
    assert.equal(await probe(path.join(file, "child")), "no"); // 父级是文件：ENOTDIR
  });
});
