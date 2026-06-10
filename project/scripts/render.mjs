#!/usr/bin/env node
/**
 * render.mjs — JSX component renderer via esbuild + Playwright.
 *
 * Bundles a JSX entry file (with React, ReactDOM, and design system components)
 * into a single IIFE, renders it in headless Chromium via Playwright, and
 * captures a PNG screenshot or PDF.
 *
 * Usage:
 *   node render.mjs --entry <path.jsx> --out <path.png|pdf> \
 *     --width <n> --height <n> [--format png|pdf] \
 *     [--props '<json>'] [--props-file <path>]
 *
 * Requires: esbuild, playwright-core, react, react-dom (all npm-installed in container).
 * Chromium must be at /usr/bin/chromium (Debian package in Docker image).
 */

import * as esbuild from 'esbuild';
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';

// ---------------------------------------------------------------------------
// CLI argument parsing (no external deps)
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    if (key.startsWith('--') && i + 1 < argv.length) {
      args[key.slice(2)] = argv[++i];
    }
  }
  return args;
}

const args = parseArgs(process.argv);

const entryPath = args.entry ? resolve(args.entry) : null;
const outPath = args.out ? resolve(args.out) : null;
const width = parseInt(args.width, 10) || 1080;
const height = parseInt(args.height, 10) || 1350;
const format = args.format || (outPath && extname(outPath).slice(1)) || 'png';

if (!entryPath) {
  console.error('ERROR: --entry <path.jsx> is required');
  process.exit(1);
}
if (!outPath) {
  console.error('ERROR: --out <path.png|pdf> is required');
  process.exit(1);
}
if (!existsSync(entryPath)) {
  console.error(`Entry file not found: ${entryPath}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Props resolution
// ---------------------------------------------------------------------------

let propsJSON = '{}';
if (args['props-file']) {
  const pf = resolve(args['props-file']);
  if (!existsSync(pf)) {
    console.error(`Props file not found: ${pf}`);
    process.exit(1);
  }
  propsJSON = readFileSync(pf, 'utf-8').trim();
} else if (args.props) {
  propsJSON = args.props;
}

// Validate JSON
try {
  JSON.parse(propsJSON);
} catch (err) {
  console.error(`Invalid props JSON: ${err.message}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

const TOKENS_PATH = '/project/design-system/tokens.css';
let tokensCSS = '';
if (existsSync(TOKENS_PATH)) {
  tokensCSS = readFileSync(TOKENS_PATH, 'utf-8');
} else {
  console.error('WARNING: Design tokens not found at ' + TOKENS_PATH);
}

// ---------------------------------------------------------------------------
// Token color validation (soft warning)
// ---------------------------------------------------------------------------

const TOKEN_COLORS = [
  '#0D1117', '#161B22', '#21262D', '#58A6FF', '#3FB950',
  '#F85149', '#D29922', '#C9D1D9', '#8B949E', '#F0F6FC',
];

// ---------------------------------------------------------------------------
// Temp file helpers
// ---------------------------------------------------------------------------

const tmpId = randomBytes(6).toString('hex');
const tmpDir = tmpdir();
const wrapperPath = resolve(tmpDir, `_render_wrapper_${tmpId}.jsx`);
const htmlPath = resolve(tmpDir, `_render_${tmpId}.html`);

function cleanup() {
  for (const f of [wrapperPath, htmlPath]) {
    try { unlinkSync(f); } catch { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// Step 1: Write a wrapper entry that imports the component and renders it
// ---------------------------------------------------------------------------

const wrapperCode = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import Component from ${JSON.stringify(entryPath)};

const props = ${propsJSON};
const root = createRoot(document.getElementById('root'));
root.render(React.createElement(Component.default || Component, props));
`;

writeFileSync(wrapperPath, wrapperCode, 'utf-8');

// ---------------------------------------------------------------------------
// Step 2: Bundle with esbuild
// ---------------------------------------------------------------------------

let bundledJS;
try {
  const result = await esbuild.build({
    entryPoints: [wrapperPath],
    bundle: true,
    jsx: 'automatic',
    format: 'iife',
    write: false,
    loader: { '.jsx': 'jsx', '.js': 'jsx', '.css': 'css' },
    nodePaths: ['/project/design-system'],
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  bundledJS = result.outputFiles[0].text;
} catch (err) {
  console.error('esbuild failed:');
  console.error(err.message || err);
  cleanup();
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Step 3: Soft-check for hardcoded token colors in the bundle
// ---------------------------------------------------------------------------

const hardcoded = TOKEN_COLORS.filter((c) => bundledJS.includes(c));
if (hardcoded.length > 0) {
  console.error(
    `WARNING: Hardcoded token colors found: ${hardcoded.join(', ')}. Use CSS variables instead.`
  );
}

// ---------------------------------------------------------------------------
// Step 4: Generate HTML shell
// ---------------------------------------------------------------------------

// Strip @import url() lines from tokens CSS — fonts are not available offline
// in Docker, and the import would cause a network fetch that hangs or fails.
const tokensCSSLocal = tokensCSS.replace(/@import\s+url\([^)]*\)\s*;?/g, '');

const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${tokensCSSLocal}</style>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${width}px; height: ${height}px; overflow: hidden; background: var(--bg-primary); }
    #root { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>${bundledJS}</script>
</body>
</html>`;

writeFileSync(htmlPath, html, 'utf-8');

// ---------------------------------------------------------------------------
// Step 5: Render with Playwright
// ---------------------------------------------------------------------------

const outDir = dirname(outPath);
if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

let browser;
try {
  browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewportSize({ width, height });
  await page.goto(`file://${htmlPath}`);
  await page.waitForLoadState('networkidle');

  if (format === 'pdf') {
    await page.pdf({
      path: outPath,
      width: `${width}px`,
      height: `${height}px`,
      printBackground: true,
    });
  } else {
    await page.screenshot({
      path: outPath,
      type: 'png',
    });
  }

  console.log(outPath);
} catch (err) {
  console.error('Playwright rendering failed:');
  console.error(err.message || err);
  cleanup();
  if (browser) await browser.close().catch(() => {});
  process.exit(1);
} finally {
  if (browser) await browser.close().catch(() => {});
  cleanup();
}
