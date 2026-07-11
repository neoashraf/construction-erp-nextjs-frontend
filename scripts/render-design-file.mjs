#!/usr/bin/env node
/**
 * render-design-file.mjs — render a Claude Design (`.dc.html`) file to a PNG so a
 * built screen can be VISUALLY compared against its design source of truth.
 *
 * Why this exists: the design files under `docs/design/design-files/` are Claude
 * Design exports — `<x-dc>` / `<sc-for>` / `<sc-if>` templating expanded at runtime
 * by `support.js`. Read as text they show `{{ placeholders }}`, not pixels, so an
 * implementer can't actually SEE the target. This runs the file through the FE
 * repo's Playwright chromium (already installed for e2e) and captures every stacked
 * artboard (default / loading / empty / tablet / mobile …) into one full-page PNG.
 *
 * Usage (from the FE repo root, `codebases/ze-erp-nextjs-frontend`):
 *   node scripts/render-design-file.mjs "<path-to .dc.html>" [--out=<dir>] [--width=1400]
 *
 * Example:
 *   node scripts/render-design-file.mjs \
 *     "../../docs/design/design-files/07-inventory/Stock Journal.dc.html"
 *
 * Output: <out>/<screen>.png  (default <out> = ./.design-shots/, git-ignored).
 * Prints the absolute PNG path — Read it to see the rendered design, then screenshot
 * your own built screen (Playwright) at the same widths and compare.
 */
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

function fail(msg) {
  console.error(`render-design-file: ${msg}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const fileArg = args.find((a) => !a.startsWith('--'));
if (!fileArg) {
  fail('missing <path-to .dc.html>. See the header comment for usage.');
}
const flag = (name, def) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
};

const filePath = path.resolve(process.cwd(), fileArg);
if (!fs.existsSync(filePath)) fail(`file not found: ${filePath}`);

const outDir = path.resolve(process.cwd(), flag('out', '.design-shots'));
const width = Number(flag('width', '1400'));
fs.mkdirSync(outDir, { recursive: true });

const base = path.basename(filePath).replace(/\.dc\.html$/i, '').replace(/\s+/g, '-');
const outPath = path.join(outDir, `${base}.png`);

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width, height: 1000 },
    deviceScaleFactor: 2,
  });
  await page.goto(pathToFileURL(filePath).href, { waitUntil: 'load' });
  // Let the DC runtime expand <x-dc>/<sc-for>/<sc-if> and web fonts settle.
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  // Hide the floating "Pages" nav widget so it doesn't cover content in the shot.
  await page.addStyleTag({ content: '#__page-nav{display:none !important;}' }).catch(() => {});
  await page.screenshot({ path: outPath, fullPage: true });
  console.log(outPath);
} finally {
  await browser.close();
}
