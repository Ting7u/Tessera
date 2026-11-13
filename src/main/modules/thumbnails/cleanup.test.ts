import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { deleteThumbs, THUMB_RE } from "./cleanup";

describe("deleteThumbs", () => {
  it("只删符合“40 位十六进制 + .jpg”格式的缩略图", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tessera-thumbs-"));
    const good = `${"a".repeat(40)}.jpg`;
    fs.writeFileSync(path.join(dir, good), "x");
    fs.writeFileSync(path.join(dir, "notes.txt"), "x");
    await deleteThumbs(dir, [
      { thumb: good },
      { thumb: "notes.txt" },
      { thumb: "../escape.jpg" },
      { thumb: null },
    ]);
    assert.ok(!fs.existsSync(path.join(dir, good)));
    assert.ok(fs.existsSync(path.join(dir, "notes.txt")));
  });
  it("THUMB_RE", () => {
    assert.ok(THUMB_RE.test(`${"0".repeat(40)}.jpg`));
    assert.ok(!THUMB_RE.test(`${"0".repeat(39)}.jpg`));
  });
});
