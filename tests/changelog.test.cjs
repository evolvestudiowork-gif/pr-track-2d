const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const changelog = require('../scripts/changelog.cjs');

const sample = `# Changelog

## [Chưa phát hành]

### Thay đổi

- Mới.

## [1.0.0]

- Cũ.

[Chưa phát hành]: https://github.com/evolvestudiowork-gif/pr-track-2d/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/evolvestudiowork-gif/pr-track-2d/releases/tag/v1.0.0
`;

test('notes returns only the requested section', () => {
  assert.equal(changelog.notes(sample, '1.0.0'), '- Cũ.\n');
  assert.throws(() => changelog.notes(sample, '9.9.9'));
});

test('release moves unreleased changes under the new version', () => {
  const next = changelog.release(sample, '1.1.0');
  assert.equal(changelog.notes(next, '1.1.0'), '### Thay đổi\n\n- Mới.\n');
  assert.match(next, /## \[Chưa phát hành\]\n\n## \[1\.1\.0\] - \d{4}-\d{2}-\d{2}/);
  assert.match(next, /\[Chưa phát hành\]: .*compare\/v1\.1\.0\.\.\.HEAD/);
  assert.match(next, /\[1\.1\.0\]: .*releases\/tag\/v1\.1\.0/);
  assert.throws(() => changelog.release(next, '1.2.0'), /empty/);
  assert.throws(() => changelog.release(sample, '1.0.0'), /already/);
});

test('the real changelog has notes for the current version', () => {
  const text = fs.readFileSync(path.join(__dirname, '../CHANGELOG.md'), 'utf8');
  const { version } = require('../package.json');
  assert.ok(changelog.notes(text, version).length > 0);
});
