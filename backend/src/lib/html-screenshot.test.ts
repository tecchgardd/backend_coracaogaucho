import assert from "node:assert/strict";
import test from "node:test";

test("renders a JPEG buffer from a simple HTML string", async () => {
  const { renderHtmlToJpeg } = await import("./html-screenshot.js");
  const buffer = await renderHtmlToJpeg(
    "<!DOCTYPE html><html><body style=\"margin:0;width:200px;height:100px;background:#1d7a4a\"></body></html>",
    200
  );
  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 0);
  // JPEG files start with the SOI marker 0xFFD8
  assert.equal(buffer[0], 0xff);
  assert.equal(buffer[1], 0xd8);
});
