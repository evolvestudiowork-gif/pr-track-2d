const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

test('every embedded version matches package.json', () => {
  assert.doesNotThrow(() =>
    execFileSync(
      process.execPath,
      [path.join(__dirname, '../scripts/sync-version.cjs'), '--check'],
      {
        stdio: 'pipe'
      }
    )
  );
});
