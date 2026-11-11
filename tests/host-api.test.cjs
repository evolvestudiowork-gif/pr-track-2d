const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = (file) => fs.readFileSync(require.resolve('../extension/' + file), 'utf8');

test('every host method the panel calls is allowed by the bridge and defined in host.jsx', () => {
  const called = new Set(
    [...read('js/panel.js').matchAll(/bridge\.call\('(\w+)'/g)].map((match) => match[1])
  );
  const allowed = read('js/bridge.js')
    .match(/\/\^\(([\w|]+)\)\$\//)[1]
    .split('|');
  const host = read('jsx/host.jsx');
  assert.ok(called.has('playhead'));
  for (const method of called) {
    assert.ok(allowed.includes(method), method + ' is not allowed by bridge.js');
    assert.match(host, new RegExp('\\n    ' + method + ': function'), method + ' missing in host');
  }
});
