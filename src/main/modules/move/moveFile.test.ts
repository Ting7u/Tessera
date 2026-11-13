import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { moveNoOverwrite, uniqueDest } from "./moveFile";

const tmp = (): string => fs.mkdtempSync(path.join(os.tmpdir(), "tessera-move-"));

describe("moveNoOverwrite", () => {
  it("移动文件：原文件消失，目标有内容", async () => {
    const dir = tmp();
    const src = path.join(dir, "a.txt");
    const dest = path.join(dir, "b.txt");
    fs.writeFileSync(src, "hello");
    await moveNoOverwrite(src, dest);
    assert.ok(!fs.existsSync(src));
    assert.equal(fs.readFileSync(dest, "utf8"), "hello");
  });

  it("目标已存在：报错，两个文件都保持原样（绝不覆盖）", async () => {
    const dir = tmp();
    const src = path.join(dir, "a.txt");
    const dest = path.join(dir, "b.txt");
    fs.writeFileSync(src, "new");
    fs.writeFileSync(dest, "old");
    await assert.rejects(moveNoOverwrite(src, dest), { code: "EEXIST" });
    assert.equal(fs.readFileSync(src, "utf8"), "new");
    assert.equal(fs.readFileSync(dest, "utf8"), "old");
  });
});

describe("uniqueDest", () => {
  it("磁盘上有或图库里记过的路径都算已占用", () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, "a.jpg"), "x");
    const recorded = path.join(dir, "a (1).jpg");
    assert.equal(
      uniqueDest(dir, "a.jpg", (p) => p === recorded),
      path.join(dir, "a (2).jpg"),
    );
    assert.equal(
      uniqueDest(dir, "b.jpg", () => false),
      path.join(dir, "b.jpg"),
    );
  });
});
