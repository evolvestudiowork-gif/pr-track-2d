/* ExtendScript (ES3): supported Premiere DOM only; no QE calls. */
var PRTrack = (function () {
  var active = null;
  var last = null;
  var TICKS_PER_SECOND = 254016000000;

  function quote(s) {
    return (
      '"' +
      String(s).replace(/[\\"\x00-\x1f\u2028\u2029]/g, function (c) {
        var n = c.charCodeAt(0).toString(16);
        return '\\u' + ('0000' + n).slice(-4);
      }) +
      '"'
    );
  }
  function json(value) {
    var a = [],
      i,
      k;
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'string') return quote(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return isFinite(value) ? String(value) : 'null';
    if (value instanceof Array) {
      for (i = 0; i < value.length; i++) a.push(json(value[i]));
      return '[' + a.join(',') + ']';
    }
    for (k in value) if (value.hasOwnProperty(k)) a.push(quote(k) + ':' + json(value[k]));
    return '{' + a.join(',') + '}';
  }
  function guard(fn) {
    try {
      return json({ ok: true, data: fn() });
    } catch (e) {
      return json({ ok: false, error: String(e.message || e) });
    }
  }
  function fail(message) {
    throw new Error(message);
  }
  function numeric(n) {
    return typeof n === 'number' && isFinite(n);
  }
  function pixelAspectRatio(value) {
    if (numeric(value)) return value;
    if (typeof value !== 'string') return NaN;
    var text = value.replace(/\s/g, '');
    var ratio = /^(\d+(?:\.\d+)?)[:\/,](\d+(?:\.\d+)?)$/.exec(text);
    if (ratio) return Number(ratio[2]) > 0 ? Number(ratio[1]) / Number(ratio[2]) : NaN;
    return /^\d+(?:\.\d+)?$/.test(text) ? Number(text) : NaN;
  }
  function time(seconds) {
    var t = new Time();
    t.seconds = seconds;
    return t;
  }
  function sequence() {
    var s = app.project.activeSequence;
    if (!s) fail('Mở một Sequence và chọn clip trên Timeline.');
    return s;
  }
  function selectedVideo(s) {
    var selection = s.getSelection(),
      clips = [],
      i;
    for (i = 0; i < selection.length; i++)
      if (selection[i].mediaType === 'Video') clips.push(selection[i]);
    if (clips.length !== 1) fail('Chọn đúng một video hoặc một Graphic trên Timeline.');
    return clips[0];
  }
  function motion(clip) {
    for (var i = 0; i < clip.components.numItems; i++) {
      if (clip.components[i].matchName === 'AE.ADBE Motion') return clip.components[i];
    }
    fail('Clip không có Motion tương thích. Hãy chọn Graphic hoặc clip lồng có Motion.');
  }
  function isPoint(value) {
    return !!value && value.length === 2 && numeric(value[0]) && numeric(value[1]);
  }
  /**
   * Named Motion parameters. Premiere's DOM exposes them only by index, and
   * displayName is localised, so the documented order is checked by the
   * shape of each value instead of by name.
   */
  function motionParams(clip) {
    var props = motion(clip).properties;
    if (props.numItems < 6) fail('Không đọc được cấu trúc Motion của phiên bản Premiere này.');
    var m = {
      position: props[0],
      scale: props[1],
      scaleWidth: props[2],
      uniformScale: props[3],
      rotation: props[4],
      anchorPoint: props[5]
    };
    var uniform = typeof m.uniformScale.getValue();
    if (
      !isPoint(m.position.getValue()) ||
      !numeric(m.scale.getValue()) ||
      !numeric(m.scaleWidth.getValue()) ||
      (uniform !== 'boolean' && uniform !== 'number') ||
      !numeric(m.rotation.getValue()) ||
      !isPoint(m.anchorPoint.getValue())
    )
      fail('Không nhận ra cấu trúc Motion của phiên bản Premiere này.');
    return m;
  }
  function anyVarying(params) {
    for (var i = 0; i < params.length; i++) if (params[i].isTimeVarying()) return true;
    return false;
  }
  function normalSpeed(clip) {
    if (Math.abs(clip.getSpeed() - 1) > 0.000001 || clip.isSpeedReversed())
      fail('Chỉ hỗ trợ tốc độ 100%, không phát ngược. Hãy xuất video đã đổi tốc độ trước.');
    if (
      Math.abs(
        clip.outPoint.seconds - clip.inPoint.seconds - (clip.end.seconds - clip.start.seconds)
      ) > 0.05
    )
      fail('Thời lượng nguồn và Timeline không khớp. Hãy xuất clip về tốc độ 100%.');
  }
  function position(param) {
    var p = param.getValue();
    if (!isPoint(p)) fail('Position của clip không phải tọa độ 2D được hỗ trợ.');
    return [p[0], p[1]];
  }
  function timing(clip, s) {
    return {
      sequenceId: String(s.sequenceID),
      nodeId: String(clip.nodeId),
      start: clip.start.seconds,
      end: clip.end.seconds,
      inPoint: clip.inPoint.seconds,
      outPoint: clip.outPoint.seconds
    };
  }
  function sourceInfo(clip, s) {
    normalSpeed(clip);
    if (!clip.projectItem || clip.projectItem.isSequence())
      fail('Hãy chọn video gốc. Chưa hỗ trợ Nested Sequence làm Source.');
    var path = clip.projectItem.getMediaPath();
    if (!path || !new File(path).exists)
      fail('Không tìm thấy video nguồn. Hãy kiểm tra liên kết tệp trong Premiere.');
    var m = motionParams(clip);
    if (anyVarying([m.position, m.scale, m.scaleWidth, m.uniformScale, m.rotation, m.anchorPoint]))
      fail('Motion của video nguồn đã có chuyển động. Hãy xuất thành video trước khi Track.');
    var scaleY = m.scale.getValue(),
      scaleX = m.uniformScale.getValue() ? scaleY : m.scaleWidth.getValue();
    var rotation = m.rotation.getValue();
    if (!numeric(scaleX) || !numeric(scaleY) || !numeric(rotation) || scaleX <= 0 || scaleY <= 0)
      fail('Không đọc được Scale/Rotation của video.');
    var settings = s.getSettings();
    var par = pixelAspectRatio(settings.videoPixelAspectRatio);
    if (!numeric(par) || Math.abs(par - 1) > 0.000001)
      fail(
        'Sequence cần dùng pixel vuông (Square Pixels). Tỷ lệ pixel hiện tại: ' +
          String(settings.videoPixelAspectRatio)
      );
    var info = timing(clip, s);
    info.name = clip.name;
    info.path = path;
    info.width = Number(s.frameSizeHorizontal);
    info.height = Number(s.frameSizeVertical);
    info.fps = TICKS_PER_SECOND / Number(s.timebase);
    info.motion = {
      scaleX: scaleX,
      scaleY: scaleY,
      rotation: rotation,
      position: position(m.position),
      anchor: m.anchorPoint.getValue()
    };
    if (!numeric(info.fps) || info.fps < 1 || info.width <= 0 || info.height <= 0)
      fail('Không đọc được kích thước hoặc frame rate của Sequence.');
    return info;
  }
  function targetInfo(clip, s, selected) {
    selected = selected || { position: true };
    normalSpeed(clip);
    var m = motionParams(clip);
    var p = m.position;
    if (!p.areKeyframesSupported()) fail('Position của clip này không hỗ trợ Keyframe.');
    if (selected.position && p.isTimeVarying())
      fail(
        'Graphic đã có Keyframe Position. Hãy dùng bản sao chưa có Keyframe hoặc gỡ chuyển động cũ.'
      );
    var info = timing(clip, s);
    info.name = clip.name;
    info.position = position(p);
    info.scale = m.scale.getValue();
    info.rotation = m.rotation.getValue();
    info.uniform = !!m.uniformScale.getValue();
    // Not read by the panel: part of the snapshot begin() compares to detect edits before Apply.
    info.transformAnimated = anyVarying([
      m.scale,
      m.scaleWidth,
      m.uniformScale,
      m.rotation,
      m.anchorPoint
    ]);
    return info;
  }
  function findClip(s, id) {
    for (var t = 0; t < s.videoTracks.numTracks; t++) {
      var clips = s.videoTracks[t].clips;
      for (var c = 0; c < clips.numItems; c++) if (String(clips[c].nodeId) === id) return clips[c];
    }
    fail('Clip đã bị xóa khỏi Sequence.');
  }
  function checkSession(job) {
    var s = sequence();
    if (String(s.sequenceID) !== job.target.sequenceId)
      fail('Sequence đã thay đổi trong lúc ghi Keyframe.');
    var clip = findClip(s, job.target.nodeId);
    if (json(timing(clip, s)) !== json(job.timing))
      fail('Graphic đã bị cắt hoặc di chuyển. Không thể tiếp tục Apply.');
    return clip;
  }
  function checkCode(code, action) {
    // CEP setters may expose a void result as undefined or null. Neither
    // proves success: readbacks below verify animation, key times/values,
    // and restored Position. Keep false distinct from numeric zero.
    if (code !== true && code !== 0 && code !== undefined && code !== null)
      fail(action + ' thất bại (mã ' + code + ').');
  }
  function setVarying(param, value, action) {
    checkCode(param.setTimeVarying(value), action);
    if (!!param.isTimeVarying() !== value)
      fail(action + ': Premiere chưa cập nhật trạng thái chuyển động.');
  }
  function samePosition(value, expected) {
    return (
      value &&
      value.length === 2 &&
      numeric(value[0]) &&
      numeric(value[1]) &&
      Math.abs(value[0] - expected[0]) <= 0.00001 &&
      Math.abs(value[1] - expected[1]) <= 0.00001
    );
  }
  function rollback(job) {
    // The caller tracks every attempted key before writing, including a write
    // which may partially succeed. Only this operation's keys are removed.
    var errors = [];
    for (var c = 0; c < job.channels.length; c++) {
      var channel = job.channels[c],
        p = channel.param;
      try {
        for (var i = job.keys.length - 1; i >= 0; i--) p.removeKey(time(job.keys[i].time));
        setVarying(p, false, 'Tắt Animation ' + channel.name);
        checkCode(p.setValue(channel.original, true), 'Khôi phục ' + channel.name);
        if (!sameValue(p.getValue(), channel.original)) fail('Chưa khôi phục được ' + channel.name);
      } catch (e) {
        errors.push(String(e.message || e));
      }
    }
    if (errors.length) fail(errors.join('\n'));
  }
  function sameValue(value, expected) {
    return numeric(expected)
      ? numeric(value) && Math.abs(value - expected) <= 0.00001
      : samePosition(value, expected);
  }
  function verifyChannels(job) {
    for (var c = 0; c < job.channels.length; c++) {
      var channel = job.channels[c],
        keys = channel.param.getKeys();
      if (!keys || keys.length !== job.keys.length)
        fail('Số Keyframe ' + channel.name + ' không khớp.');
      for (var i = 0; i < keys.length; i++) {
        var key = job.keys[i];
        if (
          !numeric(keys[i].seconds) ||
          Math.abs(keys[i].seconds - key.time) > 0.000001 ||
          !sameValue(channel.param.getValueAtKey(time(key.time)), key[channel.field])
        )
          fail('Keyframe ' + channel.name + ' đã thay đổi hoặc chưa lưu đúng.');
      }
    }
  }
  function abortWith(e) {
    var message = String(e.message || e);
    if (active) {
      try {
        rollback(active);
      } catch (restoreError) {
        message +=
          '\nKhông thể khôi phục đầy đủ: ' +
          String(restoreError.message || restoreError) +
          '. Hãy kiểm tra bảng Effect Controls.';
      }
    }
    active = null;
    fail(message);
  }
  return {
    version: '0.6.1',
    source: function () {
      return guard(function () {
        var s = sequence();
        return sourceInfo(selectedVideo(s), s);
      });
    },
    range: function (request) {
      return guard(function () {
        var s = sequence(),
          clip = findClip(s, request.source.nodeId);
        if (json(sourceInfo(clip, s)) !== json(request.source))
          fail('Video nguồn đã thay đổi. Hãy bấm Use Selected Clip lại.');
        var at = s.getPlayerPosition().seconds,
          info = request.source;
        if (!numeric(at) || at < info.start - 0.000001 || at >= info.end - 0.000001)
          fail('Đặt Playhead bên trong video nguồn rồi bấm Update Frame.');
        var offset = Math.round((at - info.start) * info.fps) / info.fps;
        var frames = Math.floor((info.end - info.start) * info.fps + 0.000001);
        offset = Math.min((frames - 1) / info.fps, offset);
        if (frames < 2) fail('Clip cần ít nhất 2 Frame.');
        if (frames > 1000000)
          fail('Đoạn cần Track vượt giới hạn 1.000.000 Frame. Hãy chia clip ngắn hơn.');
        return { startOffset: 0, seedOffset: offset, duration: frames / info.fps };
      });
    },
    playhead: function () {
      return guard(function () {
        var s = sequence();
        return { sequenceId: String(s.sequenceID), seconds: s.getPlayerPosition().seconds };
      });
    },
    target: function (request) {
      return guard(function () {
        var s = sequence();
        if (request && request.sequenceId && request.sequenceId !== String(s.sequenceID))
          fail('Target thuộc Sequence khác. Hãy bấm Use Selected Graphic lại.');
        return targetInfo(
          request && request.nodeId ? findClip(s, request.nodeId) : selectedVideo(s),
          s,
          request && request.channels
        );
      });
    },
    begin: function (request) {
      return guard(function () {
        if (active) fail('Đang ghi Keyframe, hãy chờ hoàn tất.');
        var s = sequence(),
          source = findClip(s, request.source.nodeId);
        if (json(sourceInfo(source, s)) !== json(request.source))
          fail('Video nguồn hoặc Sequence đã thay đổi. Hãy chọn lại Source và Track lại.');
        var selected = request.channels || {
          position: true,
          scale: !!request.transform,
          rotation: !!request.transform
        };
        if (!selected.position && !selected.scale && !selected.rotation)
          fail('Chọn ít nhất một Tracking Channel.');
        var clip = findClip(s, request.target.nodeId),
          target = targetInfo(clip, s, selected);
        if (target.nodeId === request.source.nodeId)
          fail('Hãy chọn Graphic đích, không phải video Source.');
        if (json(target) !== json(request.target)) fail('Graphic đã thay đổi. Hãy bấm Apply lại.');
        if (
          !numeric(request.count) ||
          request.count < 2 ||
          request.count > 1000000 ||
          request.count % 1
        )
          fail('Số lượng Keyframe không hợp lệ.');
        var m = motionParams(clip);
        var channels = [];
        if (selected.position)
          channels.push({
            param: m.position,
            original: target.position,
            field: 'value',
            name: 'Position'
          });
        if (selected.scale || selected.rotation) {
          if (
            (selected.scale && !target.uniform) ||
            (selected.scale && anyVarying([m.scale, m.scaleWidth, m.uniformScale])) ||
            (selected.rotation && m.rotation.isTimeVarying()) ||
            !numeric(target.scale) ||
            target.scale <= 0 ||
            !numeric(target.rotation)
          )
            fail('Graphic cần Uniform Scale và chưa có Animation Scale/Rotation/Anchor Point.');
          if (Math.abs(request.source.motion.scaleX - request.source.motion.scaleY) > 0.000001)
            fail('Video nguồn cần Uniform Scale để Track Scale/Rotation.');
          if (
            (selected.scale && !m.scale.areKeyframesSupported()) ||
            (selected.rotation && !m.rotation.areKeyframesSupported())
          )
            fail('Graphic không hỗ trợ Keyframe Scale/Rotation.');
          if (selected.scale)
            channels.push({
              param: m.scale,
              original: target.scale,
              field: 'scale',
              name: 'Scale'
            });
          if (selected.rotation)
            channels.push({
              param: m.rotation,
              original: target.rotation,
              field: 'rotation',
              name: 'Rotation'
            });
        }
        active = {
          target: target,
          timing: timing(clip, s),
          channels: channels,
          selected: selected,
          transform: !!(selected.scale || selected.rotation),
          keys: [],
          count: request.count
        };
        try {
          for (var c = 0; c < channels.length; c++)
            setVarying(channels[c].param, true, 'Bật Animation ' + channels[c].name);
        } catch (e) {
          abortWith(e);
        }
        return { ready: true };
      });
    },
    chunk: function (keys) {
      return guard(function () {
        if (!active) fail('Không có tác vụ ghi Keyframe đang chạy.');
        try {
          checkSession(active);
          if (
            !(keys instanceof Array) ||
            !keys.length ||
            keys.length > 100 ||
            active.keys.length + keys.length > active.count
          )
            fail('Dữ liệu Keyframe không hợp lệ.');
          for (var i = 0; i < keys.length; i++) {
            var key = keys[i],
              previous = active.keys.length ? active.keys[active.keys.length - 1].time : -Infinity;
            if (
              !numeric(key.time) ||
              key.time <= previous ||
              key.time < active.target.inPoint - 0.000001 ||
              key.time >= active.target.outPoint - 0.000001 ||
              !key.value ||
              key.value.length !== 2 ||
              !numeric(key.value[0]) ||
              !numeric(key.value[1])
            )
              fail('Tọa độ hoặc thời gian Keyframe không hợp lệ.');
            if (
              (active.selected.scale &&
                (!numeric(key.scale) || key.scale <= 0 || key.scale > 10000)) ||
              (active.selected.rotation && !numeric(key.rotation))
            )
              fail('Scale/Rotation không hợp lệ.');
            active.keys.push(key);
            var t = time(key.time);
            for (var c = 0; c < active.channels.length; c++) {
              var channel = active.channels[c],
                p = channel.param;
              checkCode(p.addKey(t), 'Thêm Keyframe ' + channel.name);
              checkCode(p.setValueAtKey(t, key[channel.field], true), 'Ghi ' + channel.name);
              // CEP has no interpolation getter. Request Linear without
              // treating a void result as an error; do not claim readback
              // verification of the interpolation mode.
              checkCode(p.setInterpolationTypeAtKey(t, 0, true), 'Đặt nội suy Linear');
            }
          }
          return { written: active.keys.length };
        } catch (e) {
          abortWith(e);
        }
      });
    },
    finish: function () {
      return guard(function () {
        if (!active) fail('Không có tác vụ cần hoàn tất.');
        try {
          checkSession(active);
          if (active.keys.length !== active.count) fail('Chưa ghi đủ Keyframe.');
          verifyChannels(active);
          last = active;
          active = null;
          return { written: last.keys.length, name: last.target.name };
        } catch (e) {
          abortWith(e);
        }
      });
    },
    abort: function () {
      return guard(function () {
        if (active) {
          rollback(active);
          active = null;
        }
        return { aborted: true };
      });
    },
    remove: function () {
      return guard(function () {
        if (active) fail('Hãy chờ ghi Keyframe xong.');
        if (!last) fail('Chưa có lần Apply nào để Remove trong phiên làm việc này.');
        checkSession(last);
        verifyChannels(last);
        rollback(last);
        last = null;
        return { removed: true };
      });
    }
  };
})();
