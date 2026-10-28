/* Shared pure functions: source pixels -> sequence coordinates -> clip-local keys. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  // CEP's mixed context exposes both CommonJS and window.
  if (root) root.TrackMapping = api;
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  function finite(n, name) {
    if (typeof n !== 'number' || !Number.isFinite(n)) throw new Error(name + ' không hợp lệ.');
    return n;
  }
  function smooth(points, radius) {
    if (!Number.isInteger(radius) || radius < 0 || radius > 10) throw new Error('Mức làm mượt không hợp lệ.');
    return points.map(function (p, i) {
      var x = 0, y = 0, scale = 0, rotation = 0, weight = 0;
      for (var j = Math.max(0, i - radius); j <= Math.min(points.length - 1, i + radius); j++) {
        var w = radius + 1 - Math.abs(j - i);
        x += points[j].x * w; y += points[j].y * w; weight += w;
        scale += (points[j].scale === undefined ? 1 : points[j].scale) * w;
        rotation += (points[j].rotation === undefined ? 0 : points[j].rotation) * w;
      }
      return {t: p.t, x: x / weight, y: y / weight, scale: scale / weight, rotation: rotation / weight};
    });
  }
  function createKeys(result, source, target, options) {
    if (!result.complete || !result.points || result.points.length < 2) throw new Error('Cần bám thành công toàn bộ đoạn đã chọn.');
    var selected = options.channels || {position:true, scale:!!options.transform, rotation:!!options.transform};
    if (!selected.position && !selected.scale && !selected.rotation) throw new Error("Chọn ít nhất một Tracking Channel.");
    options = Object.assign({}, options, {transform:!!(selected.scale || selected.rotation)});
    var points = result.points;
    points.forEach(function (p, i) {
      finite(p.t, 'Thời gian'); finite(p.x, 'X'); finite(p.y, 'Y');
      if (options.transform && (finite(p.scale, 'Scale') <= 0 || !Number.isFinite(p.rotation))) throw new Error('Dữ liệu Scale/Rotation không hợp lệ. Hãy Tracking lại.');
      if ((i === 0 && p.t !== 0) || (i && p.t <= points[i - 1].t)) throw new Error('Thời gian bám không tăng liên tục.');
    });
    var width = finite(source.width, 'Chiều rộng sequence'), height = finite(source.height, 'Chiều cao sequence');
    if (width <= 0 || height <= 0) throw new Error('Kích thước sequence không hợp lệ.');
    var gain = finite(options.gain, 'Hệ số');
    if (gain <= 0 || gain > 10) throw new Error('Hệ số phải lớn hơn 0 và không vượt quá 10.');
    var start = finite(source.start, 'Đầu clip nguồn') + finite(options.startOffset, 'Đầu đoạn cần bám');
    var targetStart = finite(target.start, 'Đầu Graphic'), targetEnd = finite(target.end, 'Cuối Graphic');
    if (targetEnd <= targetStart) throw new Error('Thời lượng Graphic không hợp lệ.');
    var sx = finite(source.motion.scaleX, 'Scale X') / 100 * gain;
    var sy = finite(source.motion.scaleY, 'Scale Y') / 100 * gain;
    var angle = finite(source.motion.rotation, 'Rotation') * Math.PI / 180;
    var c = Math.cos(angle), s = Math.sin(angle);
    if (options.transform && Math.abs(sx-sy)>1e-8) throw new Error('Tracking Scale/Rotation cần video nguồn có Uniform Scale. Hãy render trước nếu Scale X/Y khác nhau.');
    if (options.transform && ((selected.scale && !target.uniform) || finite(target.scale,'Scale ban đầu')<=0 || !Number.isFinite(target.rotation))) throw new Error('Graphic cần bật Uniform Scale và có Scale/Rotation hợp lệ.');
    // Smooth the full track before slicing, so target trim does not change the
    // measured path. The first overlapping sample becomes the new reference.
    var smoothed = smooth(points, options.smoothing);
    var filtered = smoothed.filter(function (p) {
      var at = start + p.t;
      return at >= targetStart - 1e-6 && at < targetEnd - 1e-6;
    });
    if (filtered.length < 2) throw new Error('Graphic cần giao với đoạn Tracking ít nhất 2 Frame. Đặt Graphic trong vùng đã Track.');
    var reference = filtered[0];
    if (result.seedIndex !== undefined) {
      if (!Number.isInteger(result.seedIndex) || result.seedIndex<0 || result.seedIndex>=smoothed.length) throw new Error('Frame mốc Tracking không hợp lệ.');
      var seedPoint = smoothed[result.seedIndex];
      if (start+seedPoint.t>=targetStart-1e-6 && start+seedPoint.t<targetEnd-1e-6) reference=seedPoint;
    }
    var baseX = finite(target.position[0], 'Position X'), baseY = finite(target.position[1], 'Position Y');
    return filtered.map(function (p) {
      var dx = (p.x - reference.x) * sx, dy = (p.y - reference.y) * sy;
      var key = {time: finite(target.inPoint, 'In point graphic') + start + p.t - target.start,
              value: [baseX + (dx * c - dy * s) / width, baseY + (dx * s + dy * c) / height]};
      if (options.transform) {
        key.scale = target.scale * p.scale / reference.scale;
        key.rotation = target.rotation + p.rotation - reference.rotation;
        if (!Number.isFinite(key.scale) || key.scale<=0 || key.scale>10000 || !Number.isFinite(key.rotation)) throw new Error('Scale/Rotation vượt giới hạn hỗ trợ.');
      }
      return key;
    });
  }
  return {createKeys: createKeys, smooth: smooth};
}));
