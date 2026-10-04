import assert from "node:assert/strict";
import test from "node:test";
import { cloudinaryHttps } from "./url.js";

test("cloudinaryHttps upgrades only Cloudinary http URLs", () => {
  assert.equal(cloudinaryHttps("http://res.cloudinary.com/demo/image/upload/a.jpg"), "https://res.cloudinary.com/demo/image/upload/a.jpg");
  assert.equal(cloudinaryHttps("https://res.cloudinary.com/demo/image/upload/a.jpg"), "https://res.cloudinary.com/demo/image/upload/a.jpg");
  assert.equal(cloudinaryHttps("http://example.com/a.jpg"), "http://example.com/a.jpg");
  assert.equal(cloudinaryHttps(null), null);
  assert.equal(cloudinaryHttps(undefined), undefined);
});
