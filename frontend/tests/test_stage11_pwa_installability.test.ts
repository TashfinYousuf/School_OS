// frontend/tests/test_stage11_pwa_installability.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Stage 11: PWA Installability & Manifest Compliance", () => {
  const publicDir = path.resolve(process.cwd(), "public");
  const manifestPath = path.join(publicDir, "manifest.json");
  const swPath = path.join(publicDir, "sw.js");

  it("should have a valid, well-formed manifest.json meeting Chrome PWA criteria", () => {
    assert.ok(fs.existsSync(manifestPath), "manifest.json must exist in frontend/public");
    const raw = fs.readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(raw);

    // Mandatory Chrome installability fields
    assert.ok(manifest.id, "manifest must declare an 'id'");
    assert.ok(manifest.name, "manifest must declare a 'name'");
    assert.ok(manifest.short_name, "manifest must declare a 'short_name'");
    assert.ok(manifest.start_url, "manifest must declare a 'start_url'");
    assert.strictEqual(manifest.display, "standalone", "display must be 'standalone'");
    assert.ok(manifest.theme_color, "manifest must declare 'theme_color'");
    assert.ok(manifest.background_color, "manifest must declare 'background_color'");
    assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2, "manifest must contain at least 2 icons");
  });

  it("should have actual, valid PNG icon files on disk matching manifest sizes", () => {
    const raw = fs.readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(raw);

    const sizesFound = new Set<string>();
    let hasMaskable = false;
    let hasAny = false;

    // PNG file magic header
    const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    for (const icon of manifest.icons) {
      assert.strictEqual(icon.type, "image/png", `Icon ${icon.src} must be image/png`);
      const iconDiskPath = path.join(publicDir, icon.src.replace(/^\//, ""));
      assert.ok(fs.existsSync(iconDiskPath), `Icon file must exist on disk: ${iconDiskPath}`);

      const buf = fs.readFileSync(iconDiskPath);
      assert.ok(buf.length > 500, `Icon file must not be empty or degenerate: ${iconDiskPath}`);
      assert.deepStrictEqual(buf.subarray(0, 8), PNG_HEADER, `Icon must have valid PNG magic bytes: ${iconDiskPath}`);

      sizesFound.add(icon.sizes);
      const purpose = icon.purpose || "any";
      if (purpose.includes("maskable")) hasMaskable = true;
      if (purpose.includes("any")) hasAny = true;
    }

    assert.ok(sizesFound.has("192x192"), "Must provide 192x192 icon");
    assert.ok(sizesFound.has("512x512"), "Must provide 512x512 icon");
    assert.ok(hasAny, "Must provide icon with purpose 'any'");
    assert.ok(hasMaskable, "Must provide icon with purpose 'maskable'");
  });

  it("should have apple-touch-icon.png for iOS Safari Home Screen support", () => {
    const appleIconPath = path.join(publicDir, "icons", "apple-touch-icon.png");
    assert.ok(fs.existsSync(appleIconPath), "apple-touch-icon.png must exist in frontend/public/icons");
    const buf = fs.readFileSync(appleIconPath);
    const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.deepStrictEqual(buf.subarray(0, 8), PNG_HEADER, "Apple touch icon must be valid PNG");
  });

  it("should have a resilient sw.js pre-cache configuration that avoids atomic 404 aborts", () => {
    assert.ok(fs.existsSync(swPath), "sw.js must exist in frontend/public");
    const swContent = fs.readFileSync(swPath, "utf-8");

    // Must handle install and activate
    assert.ok(swContent.includes('self.addEventListener("install"'), "sw.js must handle install event");
    assert.ok(swContent.includes('self.addEventListener("activate"'), "sw.js must handle activate event");
    assert.ok(swContent.includes('self.addEventListener("fetch"'), "sw.js must handle fetch event");

    // Must not cache sensitive API routes
    assert.ok(swContent.includes("SENSITIVE_URL_PATTERNS"), "sw.js must define sensitive URL patterns for quarantine");

    // All pre-cached assets in sw.js must actually exist in public directory
    const assetMatches = swContent.matchAll(/"(\/(?:icons\/|manifest\.json)[^"]+)"/g);
    for (const match of assetMatches) {
      const assetUrl = match[1];
      const diskPath = path.join(publicDir, assetUrl.replace(/^\//, ""));
      assert.ok(fs.existsSync(diskPath), `Asset pre-cached by sw.js must exist on disk: ${assetUrl} -> ${diskPath}`);
    }
  });
});

