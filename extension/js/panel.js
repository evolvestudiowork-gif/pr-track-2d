(function () {
  'use strict';
  var bridge = window.TrackBridge, mapping = window.TrackMapping;
  var $ = function (id) { return document.getElementById(id); };
  var canvas = $('preview'), ctx = canvas.getContext('2d');
  var state = {source: null, metadata: null, roi: null, result: null, image: null,
    busy: '', ready: false, startOffset: 0, seedOffset: 0, duration: 0, displayIndex: 0,
    currentPoint: null, target: null, appliedTargetId: null, canRemove: false, cancelled: false};
  var drag = null, imageVersion = 0, scrubTimer = null;

  function status(message, kind) {
    $('status').textContent = message; $('status').className = kind || '';
    if (state.busy === 'source' || (state.busy === 'preview' && !state.result)) {
      $('sourceStatus').hidden = false;
      $('sourceStatus').textContent = message;
      $('sourceStatus').className = 'source-status ' + (kind || '');
    }
  }
  function channels() { return {position:$('trackPosition').checked, scale:$('trackScale').checked, rotation:$('trackRotation').checked}; }
  function controls() {
    var busy = !!state.busy, selected = channels(), any = selected.position || selected.scale || selected.rotation;
    $('sourceButton').disabled = busy || !bridge.available;
    $('previewButton').disabled = busy || !state.source;
    $('trackButton').disabled = busy || !any || !state.ready || !state.roi;
    $('trackDirections').hidden = state.busy === 'track';
    $('backwardButton').disabled = $('trackButton').disabled;
    $('forwardButton').disabled = $('trackButton').disabled;
    $('targetButton').disabled = busy || !bridge.available;
    $('cancelButton').hidden = state.busy !== 'track';
    $('cancelButton').disabled = state.busy !== 'track' || state.cancelled;
    $('applyButton').disabled = busy || !any || !state.result || !state.result.complete || ((selected.scale || selected.rotation) && state.result.mode !== 'transform');
    $('applyButton').disabled = $('applyButton').disabled || !state.target || state.appliedTargetId === (state.target && state.target.nodeId);
    $('targetName').textContent = state.target ? state.target.name : 'Chưa chọn Graphic';
    $('reviewButton').hidden = busy || !state.result || !state.result.points.some(function(p){return p.estimated;});
    $('applyHelp').textContent = busy ? 'Chờ tác vụ hoàn tất hoặc bấm Stop khi đang Track.' : !state.result ? 'Track trước khi Apply.' : !state.result.complete ? 'Track chưa hoàn tất. Update Frame để Track lại.' : !any ? 'Chọn ít nhất một Channel.' : !state.target ? 'Chọn Graphic trên Timeline → Use Selected Graphic.' : state.appliedTargetId === state.target.nodeId ? 'Remove Tracking để khôi phục Graphic trước khi Apply lại.' : 'Sẵn sàng Apply vào '+state.target.name+'.';
    $('exportButton').disabled = busy || !state.result;
    $('removeButton').disabled = busy || !state.canRemove;
    $('resetButton').disabled = busy;
    $('scrub').disabled = busy || !state.result;
    ['trackPosition', 'trackScale', 'trackRotation', 'smooth', 'gain', 'python', 'checkButton'].forEach(function (id) { $(id).disabled = busy; });
  }
  async function run(kind, action) {
    if (state.busy) return;
    state.busy = kind; controls();
    try { await action(); }
    catch (e) { status(e.message || String(e), 'error'); }
    finally { state.busy = ''; controls(); }
  }
  function clearResult() {
    state.result = null; state.startOffset = 0; state.currentPoint = null; state.displayIndex = 0;
    $('scrub').value = 0; $('scrub').max = 0;
    $('confidence').textContent = 'X / Y'; $('progress').value = 0;
  }
  $('resetButton').addEventListener('click', function () {
    if (state.busy) return;
    clearTimeout(scrubTimer); scrubTimer = null;
    imageVersion++; drag = null;
    clearResult();
    state.source = null; state.target = null; state.metadata = null; state.image = null;
    state.roi = null; state.ready = false; state.seedOffset = 0; state.duration = 0; state.cancelled = false;
    // Keep the last Apply record so Remove Tracking can still restore Timeline keyframes.
    $('trackPosition').checked = true; $('trackScale').checked = false; $('trackRotation').checked = false;
    $('smooth').value = '0'; $('gain').value = '1';
    canvas.width = 960; canvas.height = 540; ctx.clearRect(0, 0, canvas.width, canvas.height);
    $('emptyPreview').hidden = false;
    $('clipName').textContent = 'Source: Chưa chọn clip';
    $('clipMeta').textContent = 'Đặt Playhead trong video rồi chọn Source.';
    $('sourceStatus').hidden = true; $('sourceStatus').textContent = '';
    $('frameLabel').textContent = 'SOURCE'; $('roiLabel').textContent = 'Khoanh vùng trong Preview';
    status('Đã Reset All. Chọn video trên Timeline → Use Selected Clip.');
    controls();
  });
  function pointToCanvas(x, y) {
    return [x / state.metadata.width * canvas.width, y / state.metadata.height * canvas.height];
  }
  function draw() {
    if (!state.image || !state.metadata) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(state.image, 0, 0, canvas.width, canvas.height);
    var points = state.result && state.result.points;
    if (points && points.length > 1) {
      ctx.strokeStyle = 'rgba(242,182,207,.85)'; ctx.lineWidth = 2; ctx.beginPath();
      points.forEach(function (p, i) { var q = pointToCanvas(p.x, p.y); if (!i) ctx.moveTo(q[0], q[1]); else ctx.lineTo(q[0], q[1]); });
      ctx.stroke();
    }
    var roi = drag ? drag.rect : state.roi;
    if (!roi) return;
    var x = roi[0], y = roi[1];
    if (!drag && state.currentPoint) { x = state.currentPoint.x - roi[2] / 2; y = state.currentPoint.y - roi[3] / 2; }
    var a = pointToCanvas(x, y), b = pointToCanvas(x + roi[2], y + roi[3]);
    ctx.strokeStyle = state.currentPoint && state.currentPoint.estimated ? '#ffd28f' : '#f2b6cf'; ctx.fillStyle = 'rgba(242,182,207,.12)'; ctx.lineWidth = 2;
    var cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
    var point = !drag && state.currentPoint;
    var scale = point && point.scale || 1, angle = (point && point.rotation || 0) * Math.PI / 180;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(angle);
    var w = (b[0]-a[0])*scale, h = (b[1]-a[1])*scale;
    ctx.fillRect(-w/2,-h/2,w,h); ctx.strokeRect(-w/2,-h/2,w,h);
    ctx.beginPath(); ctx.moveTo(-7,0); ctx.lineTo(7,0); ctx.moveTo(0,-7); ctx.lineTo(0,7); ctx.stroke();
    ctx.restore();
  }
  function showImage(url) {
    var version = ++imageVersion;
    return new Promise(function (resolve, reject) {
      var image = new Image();
      image.onload = function () {
        if (version === imageVersion) {
          state.image = image; canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
          $('emptyPreview').hidden = true; draw();
        }
        resolve();
      };
      image.onerror = function () { reject(new Error('Không hiển thị được Frame xem trước.')); };
      image.src = url;
    });
  }
  function sourcePoint(event) {
    var rect = canvas.getBoundingClientRect();
    return [Math.max(0, Math.min(state.metadata.width, (event.clientX - rect.left) / rect.width * state.metadata.width)),
      Math.max(0, Math.min(state.metadata.height, (event.clientY - rect.top) / rect.height * state.metadata.height))];
  }
  canvas.addEventListener('pointerdown', function (event) {
    if (event.button !== 0 || state.busy || !state.ready) return;
    if (state.result && state.displayIndex !== Math.round((state.seedOffset-state.startOffset) * state.source.fps)) { status('Đưa thanh xem lại về Frame mốc hoặc bấm Update Frame để khoanh vùng mới.'); return; }
    clearResult();
    var p = sourcePoint(event); drag = {start: p, rect: [p[0], p[1], 0, 0]};
    canvas.setPointerCapture(event.pointerId); controls(); draw();
  });
  canvas.addEventListener('pointermove', function (event) {
    if (!drag) return;
    var p = sourcePoint(event), a = drag.start;
    drag.rect = [Math.min(a[0], p[0]), Math.min(a[1], p[1]), Math.abs(p[0] - a[0]), Math.abs(p[1] - a[1])];
    draw();
  });
  canvas.addEventListener('pointerup', function () {
    if (!drag) return;
    var rect = drag.rect; drag = null;
    if (rect[2] < 12 || rect[3] < 12) { state.roi = null; status('Khoanh vùng rộng và cao ít nhất 12 pixel.', 'error'); }
    else { state.roi = rect; $('roiLabel').textContent = Math.round(rect[2]) + ' × ' + Math.round(rect[3]) + ' px'; status('Đã chọn vùng. Chọn hướng Track; Track Both chạy về đầu và cuối clip.'); }
    controls(); draw();
  });
  canvas.addEventListener('pointercancel', function () { drag = null; draw(); });

  async function readRange() {
    var range = await bridge.call('range', {source:state.source});
    state.startOffset = range.startOffset; state.seedOffset = range.seedOffset || 0; state.duration = range.duration;
  }
  async function loadFrame() {
    state.ready = false; state.roi = null; clearResult(); await readRange();
    status('Đang đọc Frame nguồn…');
    var response = await bridge.engine({command: 'preview', path: state.source.path, time: state.source.inPoint + state.seedOffset}, $('python').value);
    state.metadata = response.metadata;
    await showImage(response.image);
    state.ready = true;
    $('roiLabel').textContent = 'Kéo để khoanh vùng';
    $('frameLabel').textContent = 'FRAME ' + response.frame + ' · SOURCE';
    $('clipMeta').textContent = response.metadata.width + ' × ' + response.metadata.height + ' · ' + response.metadata.fps.toFixed(3) + ' fps nguồn / ' + state.source.fps.toFixed(3) + ' fps Timeline';
    status('Khoanh vùng điểm cần bám, rồi bấm Track Both Directions. Tracking hai chiều, toàn clip: ' + state.duration.toFixed(2) + ' giây.');
  }
  $('sourceButton').addEventListener('click', function () { run('source', async function () {
    state.ready = false; state.target = null; clearResult(); state.roi = null;
    status('Đang đọc clip được chọn từ Premiere…');
    state.source = await bridge.call('source');
    $('clipName').textContent = state.source.name;
    await loadFrame();
  }); });
  ['trackPosition','trackScale','trackRotation'].forEach(function(id){ $(id).addEventListener('change', function(){ controls(); if (!channels().position && !channels().scale && !channels().rotation) status('Chọn ít nhất một Channel.'); }); });
  $('previewButton').addEventListener('click', function () { run('preview', loadFrame); });
  function startTrack(direction) { if(state.busy) return; state.cancelled=false; run('track', async function () {
    var range = await bridge.call('range', {source:state.source});
    if (Math.abs((range.seedOffset || 0)-state.seedOffset)>0.000001 || Math.abs(range.duration-state.duration)>0.000001) throw new Error('Playhead đã đổi. Bấm Update Frame rồi khoanh vùng lại trước khi Tracking hai chiều.');
    clearResult(); state.cancelled = false; status('Đang Tracking chuyển động…');
    try {
      var result = await bridge.engine({command: 'track', path: state.source.path,
        start: state.source.inPoint, direction: direction, seedOffset: state.seedOffset, duration: state.duration,
        fps: state.source.fps, roi: state.roi, mode: (channels().scale || channels().rotation) ? 'transform' : 'position'}, $('python').value, function (event) {
        state.currentPoint = event.point; state.displayIndex = event.index === undefined ? event.done - 1 : event.index;
        $('progress').value = event.done / event.total * 100;
        $('confidence').textContent = event.point.estimated ? 'ESTIMATED · tiếp tục Tracking' : Math.round(event.point.confidence * 100) + '% CONFIDENCE';
        $('frameLabel').textContent = event.done + ' / ' + event.total + ' FRAMES';
        status((event.direction === 'backward' ? 'Đang Track Backward ' : 'Đang Track Forward ') + event.done + ' / ' + event.total + ' Frame…');
        showImage(event.image).catch(function () {});
      });
      result.mode = 'transform'; state.startOffset = result.analyzedStartOffset || 0; state.result = result; state.displayIndex = result.displayIndex === undefined ? result.points.length - 1 : result.displayIndex;
      state.currentPoint = result.points[state.displayIndex];
      $('scrub').max = result.points.length - 1; $('scrub').value = state.displayIndex;
      await showImage(result.image);
      if (result.complete) { $('progress').value = 100; status('Đã Track hướng chọn: ' + result.points.length + ' Frame.' + (result.estimatedFrames ? ' Có ' + result.estimatedFrames + ' Frame Estimated (dự đoán khi mất bám). Xem lại trước khi Apply.' : ' Chọn Text / Graphic để Apply.'), 'success'); }
      else status((result.failure ? 'Tracking lost tại Source Frame ' + result.failure.sourceFrame + ' · Engine ' + result.failure.engine + '\n' : '') + result.reason + '\nĐã giữ ' + result.points.length + ' Frame để xem lại hoặc xuất dữ liệu. Rút ngắn đoạn hoặc chọn vùng khác rồi bám lại.', 'error');
    } catch (e) {
      // The shown frame may be halfway through the clip after cancellation.
      // Invalidate selection to prevent drawing a new seed on the wrong frame.
      state.ready = false; state.roi = null; clearResult(); draw(); if (state.cancelled) throw new Error('Đã Stop. Bấm Update Frame rồi khoanh vùng để Track lại.'); throw e;
    }
  
  }); }
  $('trackButton').addEventListener('click', function(){startTrack('both');});
  $('backwardButton').addEventListener('click', function(){startTrack('backward');});
  $('forwardButton').addEventListener('click', function(){startTrack('forward');});
  $('targetButton').addEventListener('click', function(){run('target', async function(){
    var target = await bridge.call('target', {channels:channels()});
    if (state.source && target.sequenceId !== state.source.sequenceId) throw new Error('Chọn Graphic trong cùng Sequence với Source.');
    if (state.source && target.nodeId === state.source.nodeId) throw new Error('Hãy chọn Graphic đích, thay vì video Source.');
    state.target = target; status('Đã chọn Target: '+target.name+'.');
  });});
  $('reviewButton').addEventListener('click', function(){
    if (!state.result) return;
    var index=state.result.points.findIndex(function(p){return p.estimated;});
    if(index>=0){$('scrub').value=index;$('scrub').dispatchEvent(new Event('input'));}
  });
  $('cancelButton').addEventListener('click', function () { state.cancelled = true; bridge.cancel(); controls(); status('Đang dừng phân tích…'); });
  $('scrub').addEventListener('input', function () {
    clearTimeout(scrubTimer);
    var index = Number($('scrub').value);
    scrubTimer = setTimeout(function () { run('preview', async function () {
      if (!state.result) return;
      var p = state.result.points[index];
      var response = await bridge.engine({command: 'preview', path: state.source.path,
        time: state.source.inPoint + state.startOffset + p.t}, $('python').value);
      state.displayIndex = index; state.currentPoint = p; await showImage(response.image);
      $('frameLabel').textContent = (index + 1) + ' / ' + state.result.points.length + ' FRAMES';
      $('confidence').textContent = p.estimated ? 'ESTIMATED · vị trí dự đoán' : Math.round(p.confidence * 100) + '% CONFIDENCE';
    }); }, 180);
  });
  $('applyButton').addEventListener('click', function () { run('apply', async function () {
    var target = await bridge.call('target', {channels:channels(),nodeId:state.target.nodeId,sequenceId:state.target.sequenceId});
    if (target.sequenceId !== state.source.sequenceId) throw new Error('Chọn Text / Graphic trong cùng sequence với video đã bám.');
    var keys = mapping.createKeys(state.result, state.source, target,
      {smoothing: Number($('smooth').value), gain: Number($('gain').value), startOffset: state.startOffset, channels: channels(), transform: channels().scale || channels().rotation});
    status('Đang ghi Keyframe. Giữ nguyên Timeline đến khi hoàn tất…');
    await bridge.call('begin', {source: state.source, target: target, count: keys.length, channels: channels(), transform: channels().scale || channels().rotation});
    try {
      for (var offset = 0; offset < keys.length; offset += 60) {
        await bridge.call('chunk', keys.slice(offset, offset + 60));
        $('progress').value = Math.min(offset + 60, keys.length) / keys.length * 100;
      }
      var result = await bridge.call('finish');
      state.canRemove = true; state.appliedTargetId = target.nodeId;
      status('Đã gắn ' + result.written + ' Keyframe vào “' + result.name + '”. Phát lại để kiểm tra chữ đi theo vật thể.', 'success');
    } catch (e) {
      try { await bridge.call('abort'); }
      catch (restoreError) { throw new Error(e.message + '\nKhông khôi phục được Motion: ' + restoreError.message); }
      throw e;
    }
  }); });
  $('removeButton').addEventListener('click', function () { run('remove', async function () {
    await bridge.call('remove'); state.canRemove = false; state.appliedTargetId = null;
    status('Đã Remove Tracking: khôi phục các thuộc tính của lần Apply gần nhất.', 'success');
  }); });
  $('exportButton').addEventListener('click', function () { run('export', function () {
    if (bridge.save({schema: 'pr-track-2d/1', source: state.source, startOffset: state.startOffset,
      duration: state.duration, seedOffset: state.seedOffset, roi: state.roi, result: Object.assign({}, state.result, {image: undefined})})) status('Đã xuất dữ liệu chuyển động JSON.', 'success');
  }); });
  $('checkButton').addEventListener('click', function () { run('check', async function () {
    var result = await bridge.engine({command: 'check'}, $('python').value);
    if (!bridge.hasBundledEngine()) {
      localStorage.setItem('prtrack.python', result.executable);
      $('python').value = result.executable;
    }
    status(bridge.hasBundledEngine() ? 'Bộ xử lý tích hợp sẵn sàng. Không cần cài Python.' : 'Bộ xử lý sẵn sàng · Python ' + result.python + ' · OpenCV ' + result.opencv, 'success');
  }); });
  try { $('python').value = localStorage.getItem('prtrack.python') || bridge.configuredPython(); } catch (_) {}
  if (bridge.hasBundledEngine()) $('python').parentNode.hidden = true;
  if (!bridge.available) {
    $('hostState').textContent = 'XEM GIAO DIỆN';
    status('Đây là giao diện xem trước. Cài plugin và mở Window > Extensions > PR Track 2D trong Premiere để bám chuyển động.');
  }
  try { if ((window.cep_node ? window.cep_node.require : require)('process').platform === 'darwin') $('hostState').textContent='Premiere Pro 2026 · macOS'; } catch (_) {}
  controls();
}());
