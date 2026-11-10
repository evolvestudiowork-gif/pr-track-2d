/*
 * Pure view model: panel state in, enabled/visible flags out.
 * No DOM access, so it runs unchanged in Node tests.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TrackControls = api;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  function anyChannel(channels) {
    return !!(channels.position || channels.scale || channels.rotation);
  }

  /**
   * Why Apply is unavailable, as a TrackMessages key, or null when it is ready.
   * Checks run in the order a user would fix them.
   */
  function applyBlocker(s) {
    if (s.busy) return 'applyBusy';
    if (!s.result) return 'applyNoResult';
    if (!s.result.complete) return 'applyIncomplete';
    if (!anyChannel(s.channels)) return 'applyNoChannel';
    if (!s.target) return 'applyNoTarget';
    if (s.appliedTargetId === s.target.nodeId) return 'applyAlreadyApplied';
    return null;
  }

  /**
   * Progress through the three panel steps: 'done', 'active' or 'pending'.
   * A step becomes active once the previous one is done.
   */
  function steps(s) {
    var source = !!s.source;
    var tracked = !!(s.result && s.result.complete);
    var applied = !!(s.canRemove && s.appliedTargetId);
    function state(done, reachable) {
      return done ? 'done' : reachable ? 'active' : 'pending';
    }
    return {
      stepSource: state(source, true),
      stepTrack: state(tracked, source),
      stepApply: state(applied, tracked)
    };
  }

  /**
   * @param s {busy, ready, roi, source, result, target, appliedTargetId,
   *           canRemove, cancelled, channels, hostAvailable}
   */
  function derive(s) {
    var busy = !!s.busy;
    var tracking = s.busy === 'track';
    var cannotTrack = busy || !anyChannel(s.channels) || !s.ready || !s.roi;
    var hasEstimated =
      !!s.result &&
      s.result.points.some(function (p) {
        return p.estimated;
      });
    var blocker = applyBlocker(s);
    return {
      applyBlocker: blocker,
      steps: steps(s),
      disabled: {
        sourceButton: busy || !s.hostAvailable,
        previewButton: busy || !s.source,
        trackButton: cannotTrack,
        backwardButton: cannotTrack,
        forwardButton: cannotTrack,
        cancelButton: !tracking || !!s.cancelled,
        targetButton: busy || !s.hostAvailable,
        applyButton: blocker !== null,
        removeButton: busy || !s.canRemove,
        resetButton: busy || !s.source,
        exportButton: busy || !s.result,
        scrub: busy || !s.result,
        trackPosition: busy,
        trackScale: busy,
        trackRotation: busy,
        smooth: busy,
        gain: busy,
        python: busy,
        checkButton: busy
      },
      hidden: {
        trackDirections: tracking,
        cancelButton: !tracking,
        reviewButton: busy || !hasEstimated
      }
    };
  }

  return { anyChannel: anyChannel, applyBlocker: applyBlocker, steps: steps, derive: derive };
});
