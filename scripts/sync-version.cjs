#!/usr/bin/env node
// Copies the version in package.json into every file that embeds it.
// Usage: node scripts/sync-version.cjs [--check]
//   --check  exit 1 if any file is out of date, without writing.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const { version } = require(path.join(root, 'package.json'));
const V = '\\d+\\.\\d+\\.\\d+';

const targets = [
  ['extension/CSXS/manifest.xml', new RegExp(`(ExtensionBundleVersion=")${V}(")`)],
  [
    'extension/CSXS/manifest.xml',
    new RegExp(`(<Extension Id="vn\\.prtrack\\.panel" Version=")${V}(")`)
  ],
  ['extension/index.html', new RegExp(`(<span id="version">)${V}(<)`)],
  ['extension/jsx/host.jsx', new RegExp(`(version: ')${V}(')`)],
  ['extension/js/bridge.js', new RegExp(`(PRTrack\\.version !== ")${V}(")`)],
  ['extension/js/updates.js', new RegExp(`(var VERSION = ')${V}(')`)],
  ['extension/engine/tracker.py', new RegExp(`(ENGINE_VERSION = ")${V}(")`)]
];

const check = process.argv.includes('--check');
const stale = [];
for (const [file, pattern] of targets) {
  const full = path.join(root, file);
  const text = fs.readFileSync(full, 'utf8');
  if (!pattern.test(text)) throw new Error(`Version marker not found in ${file}: ${pattern}`);
  const next = text.replace(pattern, `$1${version}$2`);
  if (next === text) continue;
  stale.push(file);
  if (!check) fs.writeFileSync(full, next);
}

if (check && stale.length) {
  console.error(`Version ${version} not synced in:\n  ${[...new Set(stale)].join('\n  ')}`);
  console.error('Run: npm run version:sync');
  process.exit(1);
}
console.log(
  stale.length ? `Synced ${version} → ${[...new Set(stale)].join(', ')}` : `All files at ${version}`
);
