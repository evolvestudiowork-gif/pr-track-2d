#!/usr/bin/env node
// Fast static checks that run on every OS: JS syntax and version consistency.
'use strict';
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const jsDir = path.join(root, 'extension', 'js');
for (const name of fs.readdirSync(jsDir).filter((f) => f.endsWith('.js'))) {
  execFileSync(process.execPath, ['--check', path.join(jsDir, name)], { stdio: 'inherit' });
}
execFileSync(process.execPath, [path.join(__dirname, 'sync-version.cjs'), '--check'], {
  stdio: 'inherit'
});
