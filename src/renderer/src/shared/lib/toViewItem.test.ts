import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ImageRecord } from "@shared/types";
import { fmtSize, toViewItem } from "./toViewItem";

const record: ImageRecord = {
  id: 7,
  name: "a.jpg",
  path: "D:\\a.jpg",
  managed: false,
  size: 2 * 1048576,
  width: 400,
  height: 200,
  format: "JPEG",
  takenAt: Date.UTC(2026, 9, 26, 12),
  addedAt: Date.UTC(2026, 9, 27, 12),
  thumb: "abc.jpg",
  dupGroup: null,
  favorite: false,
  camera: null,
  lens: null,
  iso: null,
  aperture: null,
  shutter: null,
  focalLength: null,
  gpsLat: null,
  gpsLon: null,
  orientation: null,
  hasExifDate: false,
  tags: ["风景"],
};

describe("fmtSize", () => {
  it("MB 保留一位小数，小于 1MB 用 KB（至少 1 KB）", () => {
    assert.equal(fmtSize(1048576), "1.0 MB");
    assert.equal(fmtSize(1536 * 1024), "1.5 MB");
    assert.equal(fmtSize(2048), "2 KB");
    assert.equal(fmtSize(10), "1 KB");
  });
});

describe("toViewItem", () => {
  it("宽高比、尺寸文字、地址", () => {
    const v = toViewItem(record);
    assert.equal(v.ratio, 2);
    assert.equal(v.dimensions, "400 × 200 px");
    assert.equal(v.thumb, "tessera://thumb/abc.jpg");
    assert.equal(v.original, "tessera://original/7");
    assert.equal(v.size, "2.0 MB");
  });
  it("没有尺寸时宽高比为 1；没有缩略图时 thumb 为 null", () => {
    const v = toViewItem({ ...record, width: 0, height: 0, thumb: null });
    assert.equal(v.ratio, 1);
    assert.equal(v.dimensions, "—");
    assert.equal(v.thumb, null);
  });
  it("相似分组号不为 null 就是 duplicate", () => {
    assert.equal(toViewItem({ ...record, dupGroup: 0 }).duplicate, true);
    assert.equal(toViewItem(record).duplicate, false);
  });
  it("同一个 id 的占位色相固定", () => {
    assert.equal(toViewItem(record).hue, (7 * 47 + 188) % 360);
  });
});
