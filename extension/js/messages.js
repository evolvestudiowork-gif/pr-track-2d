/*
 * Every user-facing string of the panel UI and the engine bridge.
 *
 * Style: sentences are Vietnamese; names of Premiere concepts and of this
 * panel's buttons stay in English exactly as they appear on screen
 * (Source, Graphic, Playhead, Frame, Keyframe, Track Both, Apply…).
 */
(function (root) {
  'use strict';

  function frames(n) {
    return n + ' Frame';
  }

  root.TrackMessages = {
    // Labels
    noSource: 'Chưa chọn clip',
    noTarget: 'Chưa chọn Graphic',
    roiHint: 'Khoanh vùng trong Preview',
    roiDrag: 'Kéo để khoanh vùng',
    roiSize: function (w, h) {
      return Math.round(w) + ' × ' + Math.round(h) + ' px';
    },
    confidenceEmpty: 'X / Y',
    confidence: function (value) {
      return Math.round(value * 100) + '% CONFIDENCE';
    },
    estimatedLive: 'ESTIMATED · tiếp tục Track',
    estimatedReview: 'ESTIMATED · vị trí dự đoán',
    sourceFrame: function (frame) {
      return 'FRAME ' + frame + ' · SOURCE';
    },
    frameCounter: function (done, total) {
      return done + ' / ' + total + ' FRAMES';
    },
    clipMeta: function (meta, timelineFps) {
      return (
        meta.width +
        ' × ' +
        meta.height +
        ' · ' +
        meta.fps.toFixed(3) +
        ' fps nguồn / ' +
        timelineFps.toFixed(3) +
        ' fps Timeline'
      );
    },
    hostPreview: 'XEM GIAO DIỆN',
    hostMac: 'Premiere Pro · macOS',

    // Apply readiness (shown under the Apply button)
    applyBusy: 'Chờ tác vụ hoàn tất, hoặc bấm Stop khi đang Track.',
    applyNoResult: 'Track trước khi Apply.',
    applyIncomplete: 'Track chưa hoàn tất. Bấm Update Frame để Track lại.',
    applyNoChannel: 'Chọn ít nhất một Channel.',
    applyNoTarget: 'Chọn Graphic trên Timeline rồi bấm Use Selected Graphic.',
    applyAlreadyApplied: 'Bấm Remove Tracking để khôi phục Graphic trước khi Apply lại.',
    applyReady: function (name) {
      return 'Sẵn sàng Apply vào ' + name + '.';
    },

    // Status: Source & preview
    preview:
      'Đây là giao diện xem trước. Cài plugin rồi mở Window > Extensions > PR Track 2D trong Premiere để Track.',
    start: 'Chọn video trên Timeline rồi bấm Use Selected Clip.',
    readingSource: 'Đang đọc clip được chọn từ Premiere…',
    readingFrame: 'Đang đọc Frame nguồn…',
    frameReady: function (seconds) {
      return (
        'Khoanh vùng cần bám rồi chọn hướng Track. Độ dài clip: ' + seconds.toFixed(2) + ' giây.'
      );
    },
    previewFailed: 'Không hiển thị được Frame xem trước.',
    returnToSeed: 'Đưa thanh xem lại về Frame mốc, hoặc bấm Update Frame để khoanh vùng mới.',
    roiTooSmall: 'Vùng khoanh cần rộng và cao ít nhất 12 pixel.',
    roiSelected: 'Đã chọn vùng. Chọn hướng Track; Track Both chạy về cả đầu và cuối clip.',

    // Status: tracking
    playheadMoved: 'Playhead đã đổi. Bấm Update Frame rồi khoanh vùng lại trước khi Track.',
    tracking: 'Đang Track…',
    trackingProgress: function (direction, done, total) {
      return (
        'Đang Track ' +
        (direction === 'backward' ? 'Backward' : 'Forward') +
        ' ' +
        done +
        ' / ' +
        frames(total) +
        '…'
      );
    },
    trackDone: function (count, estimated) {
      return (
        'Đã Track ' +
        frames(count) +
        '.' +
        (estimated
          ? ' Có ' +
            frames(estimated) +
            ' Estimated (dự đoán khi mất bám), hãy xem lại trước khi Apply.'
          : ' Chọn Text / Graphic để Apply.')
      );
    },
    trackLost: function (result) {
      return (
        (result.failure
          ? 'Mất bám tại Frame nguồn ' +
            result.failure.sourceFrame +
            ' (engine ' +
            result.failure.engine +
            ').\n'
          : '') +
        result.reason +
        '\nĐã giữ ' +
        frames(result.points.length) +
        ' để xem lại hoặc xuất dữ liệu. Rút ngắn đoạn hoặc khoanh vùng khác rồi Track lại.'
      );
    },
    stopping: 'Đang dừng…',
    stopped: 'Đã Stop. Bấm Update Frame rồi khoanh vùng để Track lại.',
    resetting: 'Đang Reset Tracking…',
    resetDone: 'Đã Reset Tracking. Khoanh vùng trên Source hiện tại để Track lại.',

    // Status: target & apply
    targetOtherSequence: 'Chọn Graphic trong cùng Sequence với Source.',
    targetIsSource: 'Hãy chọn Graphic đích, không phải video Source.',
    targetSelected: function (name) {
      return 'Đã chọn Target: ' + name + '.';
    },
    writingKeys: 'Đang ghi Keyframe. Giữ nguyên Timeline đến khi hoàn tất…',
    applied: function (count, name) {
      return (
        'Đã gắn ' +
        count +
        ' Keyframe vào “' +
        name +
        '”. Phát lại để kiểm tra chữ đi theo vật thể.'
      );
    },
    restoreFailed: function (error, restoreError) {
      return error + '\nKhông khôi phục được Motion: ' + restoreError;
    },
    removed: 'Đã Remove Tracking và khôi phục thuộc tính của lần Apply gần nhất.',
    exported: 'Đã xuất dữ liệu chuyển động JSON.',
    engineBundledReady: 'Bộ xử lý tích hợp sẵn sàng. Không cần cài Python.',
    engineReady: function (python, opencv) {
      return 'Bộ xử lý sẵn sàng · Python ' + python + ' · OpenCV ' + opencv;
    },

    // Bridge
    openInPremiere: 'Mở panel từ Window > Extensions > PR Track 2D trong Premiere.',
    invalidHostCommand: 'Lệnh Premiere không hợp lệ.',
    engineHostOnly: 'Bộ xử lý chỉ chạy trong panel Premiere.',
    engineBusy: 'Đang xử lý tác vụ khác.',
    engineBadResponse: function (detail) {
      return 'Phản hồi bộ xử lý không hợp lệ: ' + detail;
    },
    engineStartFailed: function (detail) {
      return 'Không mở được bộ xử lý: ' + detail;
    },
    engineCancelled: 'Đã dừng phân tích.',
    engineCrashed: function (code) {
      return 'Bộ xử lý dừng bất thường (exit code ' + code + ').';
    },
    engineMissingModule: 'Chạy Install-PRTrack.cmd hoặc cài requirements.txt cho Python đã chọn.',
    exportHostOnly: 'Chỉ xuất được file từ panel trong Premiere.',
    exportDialogTitle: 'Xuất dữ liệu Tracking JSON'
  };
})(typeof window !== 'undefined' ? window : this);
