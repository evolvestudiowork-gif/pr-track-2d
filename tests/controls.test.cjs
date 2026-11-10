const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const controls = require('../extension/js/controls.js');

const ready = {
  busy: '',
  cancelled: false,
  ready: true,
  roi: [0, 0, 20, 20],
  source: { nodeId: 'source' },
  result: { complete: true, points: [{ estimated: false }, { estimated: true }] },
  target: { nodeId: 'graphic', name: 'Title' },
  appliedTargetId: null,
  canRemove: false,
  channels: { position: true, scale: false, rotation: false },
  hostAvailable: true
};

test('applyBlocker reports the first problem a user has to fix', () => {
  assert.equal(controls.applyBlocker(ready), null);
  assert.equal(controls.applyBlocker({ ...ready, busy: 'track', result: null }), 'applyBusy');
  assert.equal(controls.applyBlocker({ ...ready, result: null, target: null }), 'applyNoResult');
  assert.equal(
    controls.applyBlocker({ ...ready, result: { complete: false, points: [] } }),
    'applyIncomplete'
  );
  assert.equal(
    controls.applyBlocker({
      ...ready,
      channels: { position: false, scale: false, rotation: false }
    }),
    'applyNoChannel'
  );
  assert.equal(controls.applyBlocker({ ...ready, target: null }), 'applyNoTarget');
  assert.equal(
    controls.applyBlocker({ ...ready, appliedTargetId: 'graphic' }),
    'applyAlreadyApplied'
  );
});

test('every applyBlocker key has a message', () => {
  const context = vm.createContext({ window: {} });
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '../extension/js/messages.js'), 'utf8'),
    context
  );
  const messages = context.window.TrackMessages;
  for (const key of [
    'applyBusy',
    'applyNoResult',
    'applyIncomplete',
    'applyNoChannel',
    'applyNoTarget',
    'applyAlreadyApplied'
  ])
    assert.equal(typeof messages[key], 'string', key);
});

test('tracking swaps direction buttons for Stop and locks inputs', () => {
  const idle = controls.derive(ready);
  assert.equal(idle.hidden.trackDirections, false);
  assert.equal(idle.hidden.cancelButton, true);
  assert.equal(idle.disabled.trackButton, false);
  assert.equal(idle.hidden.reviewButton, false, 'estimated frames can be reviewed');

  const busy = controls.derive({ ...ready, busy: 'track' });
  assert.equal(busy.hidden.trackDirections, true);
  assert.equal(busy.hidden.cancelButton, false);
  assert.equal(busy.disabled.cancelButton, false);
  assert.equal(busy.disabled.applyButton, true);
  assert.equal(busy.disabled.gain, true);
  assert.equal(busy.hidden.reviewButton, true);

  assert.equal(
    controls.derive({ ...ready, busy: 'track', cancelled: true }).disabled.cancelButton,
    true
  );
});

test('track needs a region, a frame and at least one channel', () => {
  assert.equal(controls.derive({ ...ready, roi: null }).disabled.trackButton, true);
  assert.equal(controls.derive({ ...ready, ready: false }).disabled.forwardButton, true);
  assert.equal(
    controls.derive({ ...ready, channels: { position: false, scale: false, rotation: false } })
      .disabled.backwardButton,
    true
  );
});

test('steps unlock in order and show completion', () => {
  const fresh = { ...ready, source: null, result: null, target: null };
  assert.deepEqual(controls.steps(fresh), {
    stepSource: 'active',
    stepTrack: 'pending',
    stepApply: 'pending'
  });
  assert.deepEqual(controls.steps({ ...fresh, source: { nodeId: 's' } }), {
    stepSource: 'done',
    stepTrack: 'active',
    stepApply: 'pending'
  });
  assert.deepEqual(controls.steps(ready), {
    stepSource: 'done',
    stepTrack: 'done',
    stepApply: 'active'
  });
  assert.equal(
    controls.steps({ ...ready, canRemove: true, appliedTargetId: 'graphic' }).stepApply,
    'done'
  );
});
