import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDirectionsBlockState,
  getDirectionsDataFromBlock,
  getInitialServiceAreaFromBuilderConfig,
  hasRenderableDirectionsAddress,
  recoverServiceArea,
} from "../lib/connect-directions.ts";

test("blank serviceArea produces empty address/url and hides directions", () => {
  const result = buildDirectionsBlockState("");
  assert.equal(result.address, "");
  assert.equal(result.url, "");
  assert.equal(result.visible, false);
});

test("whitespace-only serviceArea behaves as blank", () => {
  const result = buildDirectionsBlockState("   \n  ");
  assert.equal(result.address, "");
  assert.equal(result.url, "");
  assert.equal(result.visible, false);
});

test("valid address is trimmed, encoded, and visible", () => {
  const result = buildDirectionsBlockState("  Toledo, OH  ");
  assert.equal(result.address, "Toledo, OH");
  assert.equal(result.url, "https://maps.google.com/?q=Toledo%2C%20OH");
  assert.equal(result.visible, true);
});

test("clearing a previously populated address overwrites stale address/url", () => {
  const previous = {
    address: "Nashville, TN",
    url: "https://maps.google.com/?q=Nashville%2C%20TN",
    label: "Directions",
  };
  const next = {
    ...previous,
    ...buildDirectionsBlockState("   "),
  };

  assert.equal(next.address, "");
  assert.equal(next.url, "");
  assert.equal(next.visible, false);
});

test("public rendering guard requires non-empty address and ignores stale url-only data", () => {
  assert.equal(hasRenderableDirectionsAddress({ address: "", url: "https://maps.google.com/?q=Toledo%2C%20OH" }), false);
  assert.equal(hasRenderableDirectionsAddress({ address: "   ", url: "https://maps.google.com/?q=Toledo%2C%20OH" }), false);
  assert.equal(hasRenderableDirectionsAddress({ address: "Toledo, OH", url: "" }), true);
});

test("recovered draft preserves explicit empty serviceArea", () => {
  const rawContact = { serviceArea: "" };
  const fallback = "Toledo, OH";
  assert.equal(recoverServiceArea(rawContact, fallback), "");
});

test("guided preview visibility and public render guard stay consistent", () => {
  const blank = buildDirectionsBlockState("   ");
  assert.equal(blank.visible, hasRenderableDirectionsAddress({ address: blank.address, url: blank.url }));

  const filled = buildDirectionsBlockState("Nashville, TN");
  assert.equal(filled.visible, hasRenderableDirectionsAddress({ address: filled.address, url: filled.url }));
});

test("initial service area resolves from directions block data with settings fallback", () => {
  const fromData = getInitialServiceAreaFromBuilderConfig({
    blocks: [{ type: "directions-button", data: { address: " Toledo, OH " } }],
  });
  assert.equal(fromData, "Toledo, OH");

  const fromSettings = getInitialServiceAreaFromBuilderConfig({
    blocks: [{ type: "directions-button", settings: { address: " Nashville, TN " } }],
  });
  assert.equal(fromSettings, "Nashville, TN");

  const directSettingsRead = getDirectionsDataFromBlock({ settings: { address: "City" } });
  assert.equal(directSettingsRead.address, "City");
});
