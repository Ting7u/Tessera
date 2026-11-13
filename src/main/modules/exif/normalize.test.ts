import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeExif, parseExifDate } from "./normalize";

const NOW = new Date(2026, 10, 1).getTime();

describe("parseExifDate", () => {
  it("按本地时间解析", () => {
    assert.equal(
      parseExifDate("2026:10:26 16:24:00", NOW),
      new Date(2026, 9, 26, 16, 24, 0).getTime(),
    );
  });
  it("无效值返回 null", () => {
    assert.equal(parseExifDate("0000:00:00 00:00:00", NOW), null);
    assert.equal(parseExifDate("2026:13:01 00:00:00", NOW), null); // 13 月
    assert.equal(parseExifDate("2026:02:31 00:00:00", NOW), null); // 溢出的日期
    assert.equal(parseExifDate("2030:01:01 00:00:00", NOW), null); // 未来
    assert.equal(parseExifDate(12345, NOW), null);
  });
});

describe("normalizeExif", () => {
  it("相机名：厂商和型号合并，同品牌不重复", () => {
    assert.equal(normalizeExif({ Make: "Canon", Model: "Canon EOS R5" }).camera, "Canon EOS R5");
    assert.equal(normalizeExif({ Make: "SONY", Model: "ILCE-7M4" }).camera, "SONY ILCE-7M4");
    assert.equal(normalizeExif({ Make: "Nikon" }).camera, "Nikon");
  });
  it("清理字符串里的 \\0 和空格", () => {
    assert.equal(normalizeExif({ LensModel: "  RF24-70mm\0\0 " }).lens, "RF24-70mm");
  });
  it("数值必须为正；数组取第一个", () => {
    const e = normalizeExif({ ISO: [400], FNumber: 0, ExposureTime: -1, FocalLength: 35 });
    assert.equal(e.iso, 400);
    assert.equal(e.aperture, null);
    assert.equal(e.shutter, null);
    assert.equal(e.focalLength, 35);
  });
  it("方向只接受 1~8", () => {
    assert.equal(normalizeExif({ Orientation: 6 }).orientation, 6);
    assert.equal(normalizeExif({ Orientation: 9 }).orientation, null);
  });
  it("GPS：越界或 (0,0) 视为无效", () => {
    assert.deepEqual(
      [
        normalizeExif({}, { latitude: 31.2, longitude: 121.5 }).gpsLat,
        normalizeExif({}, { latitude: 31.2, longitude: 121.5 }).gpsLon,
      ],
      [31.2, 121.5],
    );
    assert.equal(normalizeExif({}, { latitude: 0, longitude: 0 }).gpsLat, null);
    assert.equal(normalizeExif({}, { latitude: 91, longitude: 0 }).gpsLat, null);
  });
  it("空输入得到全空对象", () => {
    assert.deepEqual(normalizeExif(null), {
      takenAt: null,
      camera: null,
      lens: null,
      iso: null,
      aperture: null,
      shutter: null,
      focalLength: null,
      gpsLat: null,
      gpsLon: null,
      orientation: null,
    });
  });
});
