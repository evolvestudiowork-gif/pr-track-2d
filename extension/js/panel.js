/*
 * Panel controller: owns the state, wires DOM events to actions, and
 * re-renders after every change. Rendering rules live in controls.js and
 * preview.js; user-facing text lives in messages.js.
 */
(function () {
  'use strict';
  var bridge = window.TrackBridge;
  var mapping = window.TrackMapping;
  var controls = window.TrackControls;
  var M = window.TrackMessages;

  var HELP_URL = 'https://github.com/evolvestudiowork-gif/pr-track-2d#readme';
  var KEYS_PER_CHUNK = 60; // host.jsx accepts at most 100 per call
  var SCRUB_DEBOUNCE_MS = 180;
  var MIN_ROI_PX = 12;
  var TIME_EPSILON = 1e-6;

  function $(id) {
    return document.getElementById(id);
  }

  // ---------------------------------------------------------------- state

  var state = {
    busy: '', // name of the running action, '' when idle
    cancelled: false,
    source: null, // clip info from host.jsx source()
    metadata: null, // engine video metadata of the Source
    ready: false, // a Source frame is shown and can be selected on
    startOffset: 0, // seconds from clip In Point to first tracked sample
    seedOffset: 0, // seconds from clip In Point to the reference frame
    duration: 0,
    roi: null, // [x, y, w, h] in source pixels
    result: null, // engine track result
    displayIndex: 0, // sample shown in the preview
    currentPoint: null,
    target: null, // Graphic info from host.jsx target()
    appliedTargetId: null,
    canRemove: false
  };
  var drag = null;
  var scrubTimer = null;

  var preview = window.TrackPreview.create($('preview'), function () {
    $('emptyPreview').hidden = true;
    drawPreview();
  });

  function channels() {
    return {
      position: $('trackPosition').checked,
      scale: $('trackScale').checked,
      rotation: $('trackRotation').checked
    };
  }

  function transformChannels() {
    var c = channels();
    return c.scale || c.rotation;
  }

  function pythonPath() {
    return $('python').value;
  }

  function clearResult() {
    state.result = null;
    state.startOffset = 0;
    state.currentPoint = null;
    state.displayIndex = 0;
    $('scrub').value = 0;
    $('scrub').max = 0;
    $('confidence').textContent = M.confidenceEmpty;
    $('progress').value = 0;
  }

  function seedIndex() {
    return Math.round((state.seedOffset - state.startOffset) * state.source.fps);
  }

  // --------------------------------------------------------------- render

  function status(message, kind) {
    $('status').textContent = message;
    $('status').className = kind || '';
    // While no result exists, Source messages also appear under the clip name.
    if (state.busy === 'source' || (state.busy === 'preview' && !state.result)) {
      $('sourceStatus').hidden = false;
      $('sourceStatus').textContent = message;
      $('sourceStatus').className = 'source-status ' + (kind || '');
    }
  }

  function render() {
    var view = controls.derive({
      busy: state.busy,
      cancelled: state.cancelled,
      ready: state.ready,
      roi: state.roi,
      source: state.source,
      result: state.result,
      target: state.target,
      appliedTargetId: state.appliedTargetId,
      canRemove: state.canRemove,
      channels: channels(),
      hostAvailable: bridge.available
    });
    Object.keys(view.disabled).forEach(function (id) {
      $(id).disabled = view.disabled[id];
    });
    Object.keys(view.hidden).forEach(function (id) {
      $(id).hidden = view.hidden[id];
    });
    Object.keys(view.steps).forEach(function (id) {
      $(id).setAttribute('data-state', view.steps[id]);
    });
    $('targetName').textContent = state.target ? state.target.name : M.noTarget;
    $('applyHelp').textContent = view.applyBlocker
      ? M[view.applyBlocker]
      : M.applyReady(state.target.name);
  }

  function drawPreview() {
    preview.draw({
      metadata: state.metadata,
      points: state.result && state.result.points,
      roi: drag ? drag.rect : state.roi,
      dragging: !!drag,
      current: state.currentPoint
    });
  }

  function showConfidence(point, live) {
    $('confidence').textContent = point.estimated
      ? live
        ? M.estimatedLive
        : M.estimatedReview
      : M.confidence(point.confidence);
  }

  // -------------------------------------------------------------- actions

  /** Run one action at a time; errors end up in the status line. */
  async function run(kind, action) {
    if (state.busy) return;
    state.busy = kind;
    render();
    try {
      await action();
    } catch (e) {
      status(e.message || String(e), 'error');
    } finally {
      state.busy = '';
      render();
    }
  }

  async function showSourceFrame() {
    var response = await bridge.engine(
      {
        command: 'preview',
        path: state.source.path,
        time: state.source.inPoint + state.seedOffset
      },
      pythonPath()
    );
    state.metadata = response.metadata;
    await preview.show(response.image);
    state.ready = true;
    $('frameLabel').textContent = M.sourceFrame(response.frame);
    return response;
  }

  async function loadFrame() {
    state.ready = false;
    state.roi = null;
    clearResult();
    var range = await bridge.call('range', { source: state.source });
    state.startOffset = range.startOffset;
    state.seedOffset = range.seedOffset || 0;
    state.duration = range.duration;
    status(M.readingFrame);
    var response = await showSourceFrame();
    $('roiLabel').textContent = M.roiDrag;
    $('clipMeta').textContent = M.clipMeta(response.metadata, state.source.fps);
    status(M.frameReady(state.duration));
  }

  async function selectSource() {
    state.ready = false;
    state.target = null;
    state.roi = null;
    clearResult();
    status(M.readingSource);
    state.source = await bridge.call('source');
    $('clipName').textContent = state.source.name;
    await loadFrame();
  }

  async function reset() {
    clearTimeout(scrubTimer);
    scrubTimer = null;
    preview.invalidate();
    drag = null;
    clearResult();
    state.roi = null;
    state.ready = false;
    state.cancelled = false;
    // The last Apply record is kept so Remove Tracking still works.
    $('sourceStatus').hidden = true;
    $('sourceStatus').textContent = '';
    $('roiLabel').textContent = M.roiHint;
    drawPreview();
    status(M.resetting);
    // Back to the original reference frame, even if the Playhead moved since.
    await showSourceFrame();
    status(M.resetDone);
  }

  function onTrackProgress(event) {
    state.currentPoint = event.point;
    state.displayIndex = event.index === undefined ? event.done - 1 : event.index;
    $('progress').value = (event.done / event.total) * 100;
    $('frameLabel').textContent = M.frameCounter(event.done, event.total);
    showConfidence(event.point, true);
    status(M.trackingProgress(event.direction, event.done, event.total));
    preview.show(event.image).catch(function () {});
  }

  async function track(direction) {
    var range = await bridge.call('range', { source: state.source });
    if (
      Math.abs((range.seedOffset || 0) - state.seedOffset) > TIME_EPSILON ||
      Math.abs(range.duration - state.duration) > TIME_EPSILON
    )
      throw new Error(M.playheadMoved);
    clearResult();
    state.cancelled = false;
    status(M.tracking);
    var result;
    try {
      result = await bridge.engine(
        {
          command: 'track',
          path: state.source.path,
          start: state.source.inPoint,
          direction: direction,
          seedOffset: state.seedOffset,
          duration: state.duration,
          fps: state.source.fps,
          roi: state.roi,
          mode: transformChannels() ? 'transform' : 'position'
        },
        pythonPath(),
        onTrackProgress
      );
    } catch (e) {
      // After Stop the preview may show a frame mid-clip; drop the selection so
      // a new region cannot be drawn on the wrong frame.
      state.ready = false;
      state.roi = null;
      clearResult();
      drawPreview();
      throw state.cancelled ? new Error(M.stopped) : e;
    }
    state.startOffset = result.analyzedStartOffset || 0;
    state.result = result;
    state.displayIndex =
      result.displayIndex === undefined ? result.points.length - 1 : result.displayIndex;
    state.currentPoint = result.points[state.displayIndex];
    $('scrub').max = result.points.length - 1;
    $('scrub').value = state.displayIndex;
    await preview.show(result.image);
    if (result.complete) {
      $('progress').value = 100;
      status(M.trackDone(result.points.length, result.estimatedFrames), 'success');
    } else {
      status(M.trackLost(result), 'error');
    }
  }

  async function selectTarget() {
    var target = await bridge.call('target', { channels: channels() });
    if (state.source && target.sequenceId !== state.source.sequenceId)
      throw new Error(M.targetOtherSequence);
    if (state.source && target.nodeId === state.source.nodeId) throw new Error(M.targetIsSource);
    state.target = target;
    status(M.targetSelected(target.name));
  }

  async function showSample(index) {
    if (!state.result) return;
    var p = state.result.points[index];
    var response = await bridge.engine(
      {
        command: 'preview',
        path: state.source.path,
        time: state.source.inPoint + state.startOffset + p.t
      },
      pythonPath()
    );
    state.displayIndex = index;
    state.currentPoint = p;
    await preview.show(response.image);
    $('frameLabel').textContent = M.frameCounter(index + 1, state.result.points.length);
    showConfidence(p, false);
  }

  async function apply() {
    // Re-read the Graphic: it may have been edited since it was selected.
    var target = await bridge.call('target', {
      channels: channels(),
      nodeId: state.target.nodeId,
      sequenceId: state.target.sequenceId
    });
    if (target.sequenceId !== state.source.sequenceId) throw new Error(M.targetOtherSequence);
    // The Graphic keeps its current position at the frame under the Playhead,
    // which is where the user placed it.
    var playhead = await bridge.call('playhead');
    var keys = mapping.createKeys(state.result, state.source, target, {
      smoothing: Number($('smooth').value),
      gain: Number($('gain').value),
      startOffset: state.startOffset,
      referenceTime: playhead.sequenceId === target.sequenceId ? playhead.seconds : undefined,
      channels: channels(),
      transform: transformChannels()
    });
    status(M.writingKeys);
    await bridge.call('begin', {
      source: state.source,
      target: target,
      count: keys.length,
      channels: channels(),
      transform: transformChannels()
    });
    try {
      for (var offset = 0; offset < keys.length; offset += KEYS_PER_CHUNK) {
        await bridge.call('chunk', keys.slice(offset, offset + KEYS_PER_CHUNK));
        $('progress').value = (Math.min(offset + KEYS_PER_CHUNK, keys.length) / keys.length) * 100;
      }
      var written = await bridge.call('finish');
      state.canRemove = true;
      state.appliedTargetId = target.nodeId;
      status(M.applied(written.written, written.name), 'success');
    } catch (e) {
      try {
        await bridge.call('abort');
      } catch (restoreError) {
        throw new Error(M.restoreFailed(e.message, restoreError.message));
      }
      throw e;
    }
  }

  async function remove() {
    await bridge.call('remove');
    state.canRemove = false;
    state.appliedTargetId = null;
    status(M.removed, 'success');
  }

  function exportJson() {
    var saved = bridge.save({
      schema: 'pr-track-2d/1',
      source: state.source,
      startOffset: state.startOffset,
      duration: state.duration,
      seedOffset: state.seedOffset,
      roi: state.roi,
      result: Object.assign({}, state.result, { image: undefined })
    });
    if (saved) status(M.exported, 'success');
  }

  async function checkEngine() {
    var result = await bridge.engine({ command: 'check' }, pythonPath());
    if (bridge.hasBundledEngine()) {
      status(M.engineBundledReady, 'success');
      return;
    }
    localStorage.setItem('prtrack.python', result.executable);
    $('python').value = result.executable;
    status(M.engineReady(result.python, result.opencv), 'success');
  }

  // ---------------------------------------------------------- ROI drawing

  // Mouse events, not pointer events: Premiere's embedded Chromium (CEP 12 on
  // macOS) does not deliver pointer events for real mouse input. Move/up are
  // listened on the document so a drag that leaves the canvas still ends.
  var canvas = $('preview');

  canvas.addEventListener('mousedown', function (event) {
    if (event.button !== 0 || state.busy || !state.ready) return;
    event.preventDefault(); // no text selection or native drag while drawing
    if (state.result && state.displayIndex !== seedIndex()) {
      status(M.returnToSeed);
      return;
    }
    clearResult();
    var p = preview.toSource(event, state.metadata);
    drag = { start: p, rect: [p[0], p[1], 0, 0] };
    render();
    drawPreview();
  });

  document.addEventListener('mousemove', function (event) {
    if (!drag) return;
    var p = preview.toSource(event, state.metadata);
    var a = drag.start;
    drag.rect = [
      Math.min(a[0], p[0]),
      Math.min(a[1], p[1]),
      Math.abs(p[0] - a[0]),
      Math.abs(p[1] - a[1])
    ];
    drawPreview();
  });

  document.addEventListener('mouseup', function () {
    if (!drag) return;
    var rect = drag.rect;
    drag = null;
    if (rect[2] < MIN_ROI_PX || rect[3] < MIN_ROI_PX) {
      state.roi = null;
      status(M.roiTooSmall, 'error');
    } else {
      state.roi = rect;
      $('roiLabel').textContent = M.roiSize(rect[2], rect[3]);
      status(M.roiSelected);
    }
    render();
    drawPreview();
  });

  // --------------------------------------------------------------- wiring

  function on(id, handler) {
    $(id).addEventListener('click', handler);
  }

  on('sourceButton', function () {
    run('source', selectSource);
  });
  on('previewButton', function () {
    run('preview', loadFrame);
  });
  on('resetButton', function () {
    if (state.busy || !state.source) return;
    return run('reset', reset);
  });
  [
    ['trackButton', 'both'],
    ['backwardButton', 'backward'],
    ['forwardButton', 'forward']
  ].forEach(function (pair) {
    on(pair[0], function () {
      if (state.busy) return;
      state.cancelled = false;
      run('track', function () {
        return track(pair[1]);
      });
    });
  });
  on('cancelButton', function () {
    state.cancelled = true;
    bridge.cancel();
    render();
    status(M.stopping);
  });
  on('targetButton', function () {
    run('target', selectTarget);
  });
  on('applyButton', function () {
    run('apply', apply);
  });
  on('removeButton', function () {
    run('remove', remove);
  });
  on('exportButton', function () {
    run('export', exportJson);
  });
  on('helpLink', function () {
    if (window.cep && window.cep.util && window.cep.util.openURLInDefaultBrowser)
      window.cep.util.openURLInDefaultBrowser(HELP_URL);
    else window.open(HELP_URL, '_blank');
  });
  on('checkButton', function () {
    run('check', checkEngine);
  });
  on('reviewButton', function () {
    if (!state.result) return;
    var index = state.result.points.findIndex(function (p) {
      return p.estimated;
    });
    if (index >= 0) {
      $('scrub').value = index;
      $('scrub').dispatchEvent(new Event('input'));
    }
  });

  $('scrub').addEventListener('input', function () {
    clearTimeout(scrubTimer);
    var index = Number($('scrub').value);
    scrubTimer = setTimeout(function () {
      run('preview', function () {
        return showSample(index);
      });
    }, SCRUB_DEBOUNCE_MS);
  });

  ['trackPosition', 'trackScale', 'trackRotation'].forEach(function (id) {
    $(id).addEventListener('change', function () {
      render();
      if (!controls.anyChannel(channels())) status(M.applyNoChannel);
    });
  });

  // ----------------------------------------------------------------- init

  try {
    $('python').value = localStorage.getItem('prtrack.python') || bridge.configuredPython();
  } catch (_) {}
  if (bridge.hasBundledEngine()) $('python').parentNode.hidden = true;
  if (bridge.available) {
    status(M.start);
  } else {
    $('hostState').textContent = M.hostPreview;
    status(M.preview);
  }
  try {
    var nodeRequire = window.cep_node ? window.cep_node.require : require;
    if (nodeRequire('process').platform === 'darwin') $('hostState').textContent = M.hostMac;
  } catch (_) {}
  render();
})();
