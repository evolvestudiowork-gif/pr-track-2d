(function () {
  'use strict';
  var isHost = !!window.__adobe_cep__;
  var req = window.cep_node ? window.cep_node.require : (typeof require === 'function' ? require : null);
  var fs = req && req('fs'), path = req && req('path'), childProcess = req && req('child_process');
  var root = isHost ? decodeURI(window.__adobe_cep__.getSystemPath('extension')).replace(/^file:\/\//, '') : '';
  if (/^\/[a-z]:/i.test(root)) root = root.slice(1);
  var current = null;

  function call(method, arg) {
    if (!isHost) return Promise.reject(new Error('Mở panel từ Window > Extensions > PR Track 2D trong Premiere.'));
    if (!/^(source|range|target|begin|chunk|finish|abort|remove)$/.test(method)) return Promise.reject(new Error('Lệnh Premiere không hợp lệ.'));
    var payload = arg === undefined ? '' : JSON.stringify(arg).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    // Premiere can retain the old ExtendScript namespace after a panel is reopened.
    // Load this installed version once; leave an up-to-date namespace/session intact.
    var hostPath = JSON.stringify(root.replace(/\\/g, '/') + '/jsx/host.jsx');
    var script = '(function(){if(typeof PRTrack === "undefined" || PRTrack.version !== "0.5.1"){' +
      '$.evalFile(new File(' + hostPath + '));}return PRTrack.' + method + '(' + payload + ');}())';
    return new Promise(function (resolve, reject) {
      // No timeout for mutations: reporting a timeout while Premiere still writes
      // would race a second apply against the first operation.
      window.__adobe_cep__.evalScript(script, function (raw) {
        try {
          var response = JSON.parse(raw);
          if (!response.ok) throw new Error(response.error);
          resolve(response.data);
        } catch (error) { reject(new Error(error.message || raw)); }
      });
    });
  }
  function configuredPython() {
    try {
      var config = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8').replace(/^\uFEFF/, ''));
      return config.python || '';
    } catch (_) { return ''; }
  }
  function hasBundledEngine() {
    return !!(fs && path && fs.existsSync(bundledPath()));
  }
  function bundledPath() {
    return path.join(root, 'runtime', process.platform === 'darwin' ? 'PRTrackEngine' : 'PRTrackEngine.exe');
  }
  function engine(request, python, onProgress) {
    if (!req || !isHost) return Promise.reject(new Error('Bộ xử lý chỉ chạy trong panel Premiere.'));
    if (current) return Promise.reject(new Error('Đang xử lý tác vụ khác.'));
    var bundled = bundledPath();
    var portable = hasBundledEngine();
    var executable = portable ? bundled : (python.trim() || configuredPython() || (process.platform === 'darwin' ? 'python3' : 'python'));
    var args = portable ? [] : ['-u', path.join(root, 'engine', 'tracker.py')];
    return new Promise(function (resolve, reject) {
      var proc = childProcess.spawn(executable, args, {
        windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'],
        env: Object.assign({}, process.env, {PYTHONIOENCODING: 'utf-8'})
      });
      var job = {process: proc, cancelled: false};
      current = job;
      var pending = '', stderr = '', result = null, failure = null;
      proc.stdout.setEncoding('utf8'); proc.stderr.setEncoding('utf8');
      proc.stdout.on('data', function (data) {
        pending += data;
        var newline;
        while ((newline = pending.indexOf('\n')) >= 0) {
          var line = pending.slice(0, newline); pending = pending.slice(newline + 1);
          if (!line.trim()) continue;
          try {
            var event = JSON.parse(line);
            if (event.type === 'result') result = event.result;
            else if (event.type === 'error') failure = event.message;
            else if (event.type === 'progress' && onProgress) onProgress(event);
          } catch (e) { failure = 'Phản hồi bộ xử lý không hợp lệ: ' + e.message; }
        }
      });
      proc.stderr.on('data', function (data) { stderr = (stderr + data).slice(-4000); });
      proc.stdin.on('error', function () { /* The exit handler reports startup failures. */ });
      proc.on('error', function (error) { failure = 'Không mở được bộ xử lý: ' + error.message; });
      proc.on('close', function (code) {
        if (current === job) current = null;
        if (job.cancelled) return reject(new Error('Đã dừng phân tích. Có thể chọn lại vùng rồi chạy tiếp.'));
        if (failure || code !== 0 || !result) {
          var message = failure || stderr.trim() || 'Engine dừng bất thường (exit code ' + code + ').';
          if (/No module named/.test(message)) message += '\nChạy Install-PRTrack.cmd hoặc cài requirements.txt cho Python đã chọn.';
          return reject(new Error(message));
        }
        resolve(result);
      });
      proc.stdin.end(JSON.stringify(request) + '\n', 'utf8');
    });
  }
  function cancel() { if (current) { current.cancelled = true; current.process.kill(); } }
  function save(data) {
    if (!window.cep || !window.cep.fs) throw new Error('Chỉ xuất file từ panel Premiere.');
    var dialog = window.cep.fs.showSaveDialogEx('Xuất tracking JSON', '', ['json'], 'pr-track.json');
    if (dialog.err || !dialog.data) return false;
    fs.writeFileSync(dialog.data, JSON.stringify(data, null, 2), 'utf8');
    return true;
  }
  window.addEventListener('beforeunload', cancel);
  window.TrackBridge = {call: call, engine: engine, cancel: cancel, save: save,
    available: isHost, configuredPython: configuredPython, hasBundledEngine: hasBundledEngine};
}());
