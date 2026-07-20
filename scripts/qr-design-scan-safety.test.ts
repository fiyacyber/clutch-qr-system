import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_QR_DESIGN,
  circularCanvasContainsQuietZone,
  contrastRatio,
  getQrCanvasLayout,
  getQrDesignScanIssues,
  hasPrintSafeContrast,
  normalizeCircleDesign,
  type AdvancedQrDesign,
} from "../lib/qr-design.ts";

function design(overrides: Partial<AdvancedQrDesign> = {}): AdvancedQrDesign {
  return { ...DEFAULT_QR_DESIGN, ...overrides };
}

test("circular layouts contain the complete four-module quiet-zone square", () => {
  for (const matrixSize of [21, 25, 29, 33, 41, 57, 97, 177]) {
    const layout = getQrCanvasLayout(matrixSize, "circle");
    assert.equal(layout.quietZone, 4);
    assert.equal(layout.offset - matrixSize * 0, (layout.total - matrixSize) / 2);
    assert.ok(layout.offset >= 4);
    assert.equal(circularCanvasContainsQuietZone(matrixSize), true);
  }
});

test("square layouts preserve the standard four-module quiet zone", () => {
  const layout = getQrCanvasLayout(29, "square");
  assert.deepEqual(layout, {
    quietZone: 4,
    quietSquareSize: 37,
    total: 37,
    offset: 4,
  });
});

test("safe circular design passes structural checks", () => {
  const issues = getQrDesignScanIssues(design({
    qrShape: "circle",
    bodyPattern: "rounded",
    eyeFrameShape: "circle",
    eyeCenterShape: "rounded",
  }));
  assert.deepEqual(issues, []);
});

test("circular designs reject narrow modules and heavily altered finder patterns", () => {
  const issues = getQrDesignScanIssues(design({
    qrShape: "circle",
    bodyPattern: "vertical-bars",
    eyeFrameShape: "diamond",
    eyeCenterShape: "star",
  }));
  assert.equal(issues.length, 3);
  assert.match(issues[0], /body modules/i);
  assert.match(issues[1], /eye frames/i);
  assert.match(issues[2], /eye centers/i);
});

test("circle normalization replaces unsupported geometry with conservative defaults", () => {
  const normalized = normalizeCircleDesign(design({
    qrShape: "circle",
    bodyPattern: "cross",
    eyeFrameShape: "octagon",
    eyeCenterShape: "diamond",
  }));
  assert.equal(normalized.bodyPattern, "square");
  assert.equal(normalized.eyeFrameShape, "square");
  assert.equal(normalized.eyeCenterShape, "square");
});

test("print-safe contrast requires dark modules on a lighter background", () => {
  assert.equal(hasPrintSafeContrast("#384862", "#ffffff"), true);
  assert.equal(hasPrintSafeContrast("#dddddd", "#ffffff"), false);
  assert.equal(hasPrintSafeContrast("#ffffff", "#000000"), false);
  assert.ok(contrastRatio("#384862", "#ffffff") >= 4.5);
});

test("gradients and finder colors are checked independently", () => {
  const issues = getQrDesignScanIssues(design({
    colorMode: "linear",
    gradientEndColor: "#eeeeee",
    eyeFrameColor: "#dddddd",
    eyeCenterColor: "#cccccc",
  }));
  assert.equal(issues.length, 3);
  assert.match(issues[0], /gradient/i);
  assert.match(issues[1], /eye-frame/i);
  assert.match(issues[2], /eye-center/i);
});

test("invalid matrix dimensions are rejected", () => {
  assert.throws(() => getQrCanvasLayout(0, "circle"), /positive integer/i);
  assert.throws(() => getQrCanvasLayout(29.5, "circle"), /positive integer/i);
});
