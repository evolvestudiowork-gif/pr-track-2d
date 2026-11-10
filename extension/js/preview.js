/*
 * Preview canvas: shows engine frames and draws the tracked region on top.
 * Coordinates passed in and out are source-video pixels.
 */
(function (root) {
  'use strict';

  // Sizes in on-screen pixels; the canvas itself is the frame's resolution.
  var LINE_PX = 2;
  var CROSSHAIR_PX = 7;
  var ROI_FILL_ALPHA = 0.18;

  function cssColor(name, fallback) {
    try {
      var value = root.getComputedStyle(root.document.documentElement).getPropertyValue(name);
      return value.trim() || fallback;
    } catch (_) {
      return fallback;
    }
  }

  /**
   * @param canvas  the <canvas> element
   * @param onShow  called after a new frame is on screen
   */
  function create(canvas, onShow) {
    var ctx = canvas.getContext('2d');
    var image = null;
    var version = 0;

    /** Load a frame (data URL). Older loads that finish late are ignored. */
    function show(url) {
      var mine = ++version;
      return new Promise(function (resolve, reject) {
        var next = new Image();
        next.onload = function () {
          if (mine === version) {
            image = next;
            canvas.width = next.naturalWidth;
            canvas.height = next.naturalHeight;
            onShow();
          }
          resolve();
        };
        next.onerror = function () {
          reject(new Error(root.TrackMessages.previewFailed));
        };
        next.src = url;
      });
    }

    /** Drop any frame that is still loading. */
    function invalidate() {
      version++;
    }

    /** Map a pointer event to source pixels, clamped to the frame. */
    function toSource(event, metadata) {
      var rect = canvas.getBoundingClientRect();
      var x = ((event.clientX - rect.left) / rect.width) * metadata.width;
      var y = ((event.clientY - rect.top) / rect.height) * metadata.height;
      return [Math.max(0, Math.min(metadata.width, x)), Math.max(0, Math.min(metadata.height, y))];
    }

    /**
     * @param view {metadata, points, roi: [x, y, w, h], dragging,
     *              current: tracked point to centre the ROI on, or null}
     */
    function draw(view) {
      if (!image || !view.metadata) return;
      // Read per draw: the theme can change while the panel is open.
      var colors = {
        accent: cssColor('--accent', '#378ef0'),
        estimated: cssColor('--estimated', '#e8a33d')
      };
      var sx = canvas.width / view.metadata.width;
      var sy = canvas.height / view.metadata.height;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      // Scale so lines stay LINE_PX wide however large the frame is.
      var displayed = canvas.getBoundingClientRect().width;
      var px = displayed > 0 ? canvas.width / displayed : 1;
      var cross = CROSSHAIR_PX * px;
      ctx.lineWidth = LINE_PX * px;

      if (view.points && view.points.length > 1) {
        ctx.strokeStyle = colors.accent;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        view.points.forEach(function (p, i) {
          if (i) ctx.lineTo(p.x * sx, p.y * sy);
          else ctx.moveTo(p.x * sx, p.y * sy);
        });
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      var roi = view.roi;
      if (!roi) return;
      var point = view.dragging ? null : view.current;
      var cx = point ? point.x : roi[0] + roi[2] / 2;
      var cy = point ? point.y : roi[1] + roi[3] / 2;
      var scale = (point && point.scale) || 1;
      var w = roi[2] * sx * scale;
      var h = roi[3] * sy * scale;

      ctx.save();
      ctx.translate(cx * sx, cy * sy);
      ctx.rotate((((point && point.rotation) || 0) * Math.PI) / 180);
      ctx.strokeStyle = point && point.estimated ? colors.estimated : colors.accent;
      ctx.fillStyle = colors.accent;
      ctx.globalAlpha = ROI_FILL_ALPHA;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.globalAlpha = 1;
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.beginPath();
      ctx.moveTo(-cross, 0);
      ctx.lineTo(cross, 0);
      ctx.moveTo(0, -cross);
      ctx.lineTo(0, cross);
      ctx.stroke();
      ctx.restore();
    }

    return { show: show, invalidate: invalidate, toSource: toSource, draw: draw };
  }

  root.TrackPreview = { create: create };
})(typeof window !== 'undefined' ? window : this);
