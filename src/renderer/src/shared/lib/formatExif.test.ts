import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildExifRows,
  formatAperture,
  formatFocalLength,
  formatGps,
  formatShutter,
  type ExifSource,
} from "./formatExif";

const empty: ExifSource = {
  hasExifDate: false,
  takenAt: 0,
  camera: null,
  lens: null,
  aperture: null,
  shutter: null,
  iso: null,
  focalLength: null,
  gpsLat: null,
  gpsLon: null,
};

describe("格式化", () => {
  it("快门：慢于 1/3 秒写小数，其余写分数", () => {
    assert.equal(formatShutter(0.8), "0.8 s");
    assert.equal(formatShutter(2), "2 s");
    assert.equal(formatShutter(1 / 250), "1/250 s");
  });
  it("光圈、焦距", () => {
    assert.equal(formatAperture(1.8), "f/1.8");
    assert.equal(formatAperture(8), "f/8");
    assert.equal(formatFocalLength(35), "35 mm");
  });
  it("GPS：南纬、西经带方向", () => {
    assert.equal(formatGps(30.5, 120.25), "30.5000° N, 120.2500° E");
    assert.equal(formatGps(-33.8, -70.6), "33.8000° S, 70.6000° W");
  });
});

describe("buildExifRows", () => {
  it("什么都没有时返回空数组", () => {
    assert.deepEqual(buildExifRows(empty), []);
  });
  it("曝光参数合成一行，只包含读到的部分", () => {
    const rows = buildExifRows({ ...empty, aperture: 2.8, iso: 100 });
    assert.deepEqual(rows, [{ id: "exposure", value: "f/2.8 · ISO 100" }]);
  });
  it("没有 EXIF 日期时不显示拍摄时间", () => {
    assert.equal(buildExifRows({ ...empty, takenAt: 1_700_000_000_000 }).length, 0);
    assert.equal(
      buildExifRows({ ...empty, hasExifDate: true, takenAt: 1_700_000_000_000 })[0].id,
      "takenAt",
    );
  });
  it("GPS 为 0,0 也算有（只排除 null）", () => {
    const rows = buildExifRows({ ...empty, gpsLat: 0, gpsLon: 0 });
    assert.equal(rows[0].id, "gps");
  });
});
