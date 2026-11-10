#!/usr/bin/env node
// CHANGELOG.md helper.
//   node scripts/changelog.cjs notes [version]  print the section for a version (default: package.json)
//   node scripts/changelog.cjs release          turn "Chưa phát hành" into the package.json version
// `release` runs from `npm version` so the changelog, tag and files always agree.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const UNRELEASED = 'Chưa phát hành';
const REPO = 'https://github.com/evolvestudiowork-gif/pr-track-2d';
const file = path.join(__dirname, '..', 'CHANGELOG.md');

function escape(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Body of `## [name]...` up to the next `## [` heading or link references. */
function section(text, name) {
  const heading = new RegExp(`^## \\[${escape(name)}\\][^\\n]*\\n`, 'm');
  const match = heading.exec(text);
  if (!match) return null;
  const start = match.index + match[0].length;
  const rest = text.slice(start);
  const end = rest.search(/^## \[|^\[[^\]]+\]: /m);
  return { start: match.index, bodyStart: start, end: start + (end < 0 ? rest.length : end) };
}

function notes(text, version) {
  const s = section(text, version);
  if (!s) throw new Error(`CHANGELOG.md has no section for ${version}`);
  const body = text.slice(s.bodyStart, s.end).trim();
  if (!body) throw new Error(`CHANGELOG.md section ${version} is empty`);
  return body + '\n';
}

function release(text, version) {
  if (section(text, version)) throw new Error(`CHANGELOG.md already has ${version}`);
  const s = section(text, UNRELEASED);
  if (!s) throw new Error(`CHANGELOG.md has no "${UNRELEASED}" section`);
  const body = text.slice(s.bodyStart, s.end).trim();
  if (!body) throw new Error(`"${UNRELEASED}" is empty: describe the changes before releasing`);
  const date = new Date().toISOString().slice(0, 10);
  let next =
    text.slice(0, s.start) +
    `## [${UNRELEASED}]\n\n## [${version}] - ${date}\n\n${body}\n\n` +
    text.slice(s.end);
  next = next.replace(
    new RegExp(`^\\[${escape(UNRELEASED)}\\]: .*$`, 'm'),
    `[${UNRELEASED}]: ${REPO}/compare/v${version}...HEAD\n[${version}]: ${REPO}/releases/tag/v${version}`
  );
  return next;
}

if (require.main === module) {
  const [command, arg] = process.argv.slice(2);
  const version = arg || require('../package.json').version;
  const text = fs.readFileSync(file, 'utf8');
  try {
    if (command === 'notes') process.stdout.write(notes(text, version));
    else if (command === 'release') {
      fs.writeFileSync(file, release(text, version));
      console.log(`CHANGELOG.md: "${UNRELEASED}" → ${version}`);
    } else throw new Error('Usage: changelog.cjs notes [version] | release');
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { notes, release };
