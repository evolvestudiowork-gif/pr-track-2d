const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const {EventEmitter} = require('node:events');

for (const platform of ['win32','darwin']) test(platform + ' bundled engine ignores stale Python configuration and receives no script arguments', async () => {
  let invocation;
  const context = {
    process: {env: {}, platform},
    window: {__adobe_cep__: {getSystemPath: () => 'D:/Panel with spaces'}, addEventListener() {}},
    require: name => ({
      fs: {existsSync: p => p.endsWith(platform==='darwin'?'PRTrackEngine':'PRTrackEngine.exe')}, path,
      child_process: {spawn(executable, args, options) {
        invocation = {executable, args, options};
        const proc = new EventEmitter();
        proc.stdout = new EventEmitter(); proc.stderr = new EventEmitter();
        proc.stdout.setEncoding = proc.stderr.setEncoding = () => {};
        proc.stdin = new EventEmitter();
        proc.stdin.end = () => queueMicrotask(() => {
          proc.stdout.emit('data', '{"type":"result","result":{"ready":true}}\n');
          proc.emit('close', 0);
        });
        return proc;
      }}
    })[name]
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../extension/js/bridge.js'), 'utf8'), context);
  assert.equal(context.window.TrackBridge.hasBundledEngine(), true);
  const result = await context.window.TrackBridge.engine({command:'check'}, 'C:/missing/python.exe');
  assert.equal(result.ready, true);
  assert.ok(invocation.executable.endsWith(platform==='darwin'?'PRTrackEngine':'PRTrackEngine.exe'));
  assert.equal(invocation.args.length, 0);
  assert.equal(invocation.options.shell, false);
  assert.equal(invocation.options.windowsHide, true);
});
