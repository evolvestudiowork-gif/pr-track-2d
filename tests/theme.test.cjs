const { test } = require('node:test');
const assert = require('node:assert/strict');
const theme = require('../extension/js/theme.js');

test('dark Premiere panels get light text and raised surfaces', () => {
  const p = theme.palette({ red: 35, green: 35, blue: 35 });
  assert.equal(p.light, false);
  assert.equal(p.vars['--bg'], '#232323');
  assert.ok(p.vars['--surface'] > p.vars['--bg'], 'surface is lighter than background');
  assert.ok(p.vars['--bg-sunken'] < p.vars['--bg'], 'inputs are darker than background');
  assert.equal(p.vars['--text'], '#e3e3e3');
});

test('light Premiere panels flip text and surfaces', () => {
  const p = theme.palette({ red: 214, green: 214, blue: 214 });
  assert.equal(p.light, true);
  assert.ok(p.vars['--surface'] < p.vars['--bg'], 'surface is darker than a light background');
  assert.ok(p.vars['--bg-sunken'] > p.vars['--bg'], 'inputs are lighter on a light panel');
  assert.equal(p.vars['--text'], '#1d1d1d');
});
