"""One request on stdin; newline-delimited JSON events on stdout. No network I/O."""

from __future__ import annotations

import base64
import json
import math
import sys
import time

import cv2
import numpy as np

ENGINE_VERSION = "0.5.2"
MAX_SAMPLES = 1000000


def emit(event):
    print(json.dumps(event, ensure_ascii=True, allow_nan=False), flush=True)


def number(value, name, minimum=0, maximum=float("inf")):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{name} phải là số.")
    if not math.isfinite(value) or not minimum <= value <= maximum:
        raise ValueError(f"{name} nằm ngoài giới hạn cho phép.")
    return float(value)


def jpeg(frame, max_width=960):
    scale = min(1.0, max_width / frame.shape[1])
    small = cv2.resize(frame, (round(frame.shape[1] * scale), round(frame.shape[0] * scale)))
    ok, data = cv2.imencode(".jpg", small, [cv2.IMWRITE_JPEG_QUALITY, 82])
    if not ok:
        raise ValueError("Không tạo được ảnh xem trước.")
    return "data:image/jpeg;base64," + base64.b64encode(data).decode("ascii")


class Video:
    def __init__(self, path):
        if not isinstance(path, str) or not path:
            raise ValueError("Thiếu đường dẫn video.")
        self.cap = cv2.VideoCapture(path)
        if not self.cap.isOpened():
            self.cap.release()
            raise ValueError("Không đọc được video. Hãy thử bản render H.264 CFR hoặc ProRes.")
        self.fps = self.cap.get(cv2.CAP_PROP_FPS)
        self.count = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT))
        self.width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        self.height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        rotation = self.cap.get(cv2.CAP_PROP_ORIENTATION_META)
        sar_n = self.cap.get(cv2.CAP_PROP_SAR_NUM)
        sar_d = self.cap.get(cv2.CAP_PROP_SAR_DEN)
        try:
            number(self.fps, "FPS nguồn", 1, 240)
            if min(self.count, self.width, self.height) <= 0:
                raise ValueError("Video không có thông tin số khung hình hợp lệ.")
            if rotation not in (0, 360):
                raise ValueError("Video có metadata xoay. Hãy render thành video đúng chiều trước.")
            if sar_d > 0 and sar_n > 0 and abs(sar_n / sar_d - 1) > 0.001:
                raise ValueError("Bản này cần footage pixel vuông (pixel aspect ratio = 1).")
        except Exception:
            self.cap.release()
            raise
        self.index = -1
        self.frame = None

    def close(self):
        self.cap.release()

    def metadata(self):
        return dict(
            width=self.width,
            height=self.height,
            fps=self.fps,
            frames=self.count,
            duration=self.count / self.fps,
        )

    def seek(self, seconds):
        index = math.floor(number(seconds, "Thời điểm nguồn") * self.fps + 1e-7)
        if index >= self.count:
            raise ValueError("Thời điểm bắt đầu nằm ngoài video.")
        self.cap.set(cv2.CAP_PROP_POS_FRAMES, index)
        ok, frame = self.cap.read()
        if not ok:
            raise ValueError("Không giải mã được khung hình bắt đầu.")
        actual = self.cap.get(cv2.CAP_PROP_POS_FRAMES) - 1
        if abs(actual - index) > 0.5:
            raise ValueError("Codec không seek chính xác theo frame. Hãy render sang CFR trước.")
        self.index, self.frame = index, frame
        return frame

    def next(self):
        ok, frame = self.cap.read()
        if not ok:
            raise ValueError("Không giải mã được frame kế tiếp; quá trình đã dừng.")
        self.index += 1
        self.frame = frame
        return frame


class LostTrack(ValueError):
    pass


# --------------------------------------------------------------------------
# Shared building blocks

MIN_ROI_PX = 12
ANALYSIS_MAX_WIDTH = 1280  # frames are downscaled to this width before tracking
PATCH_SIZE = 48  # appearance template is resampled to PATCH_SIZE x PATCH_SIZE
LK_PARAMS = dict(
    winSize=(21, 21),
    maxLevel=3,
    criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 30, 0.01),
)
LK_MAX_FORWARD_BACKWARD_PX = 1.25
LK_MAX_ERROR = 35


def parse_roi(frame, roi):
    """Validate an [x, y, w, h] region in source pixels."""
    if not isinstance(roi, list) or len(roi) != 4:
        raise ValueError("Cần khoanh vùng Track trước.")
    x, y, w, h = [number(v, "Vùng Track") for v in roi]
    fh, fw = frame.shape[:2]
    if w < MIN_ROI_PX or h < MIN_ROI_PX or x + w > fw + 0.1 or y + h > fh + 0.1:
        raise ValueError("Vùng Track phải nằm trong hình và rộng/cao ít nhất 12 pixel.")
    return x, y, w, h


class Downscaler:
    """Converts source frames to the grayscale analysis resolution."""

    def __init__(self, frame, max_width=ANALYSIS_MAX_WIDTH):
        fh, fw = frame.shape[:2]
        self.scale = min(1.0, max_width / fw)
        self.size = (round(fw * self.scale), round(fh * self.scale))

    def gray(self, frame):
        small = cv2.resize(frame, self.size, interpolation=cv2.INTER_AREA)
        return cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)


def rect_mask(shape, roi):
    x, y, w, h = roi
    mask = np.zeros(shape, dtype=np.uint8)
    x0, y0 = max(0, math.ceil(x)), max(0, math.ceil(y))
    x1, y1 = min(shape[1], math.floor(x + w)), min(shape[0], math.floor(y + h))
    mask[y0:y1, x0:x1] = 255
    return mask


def polygon_mask(shape, corners):
    mask = np.zeros(shape, dtype=np.uint8)
    cv2.fillConvexPoly(mask, np.round(corners).astype(np.int32), 255)
    return mask


def find_corners(gray, mask):
    return cv2.goodFeaturesToTrack(
        gray, maxCorners=150, qualityLevel=0.015, minDistance=4, mask=mask, blockSize=5
    )


def lucas_kanade(previous, gray, points):
    """Pyramidal LK with a forward/backward consistency check.

    Returns (old, new, good): point arrays and a mask of reliable matches.
    """
    forward, valid, error = cv2.calcOpticalFlowPyrLK(previous, gray, points, None, **LK_PARAMS)
    if forward is None:
        raise LostTrack("Mất điểm bám. Hãy chọn vùng rõ hơn.")
    back, back_valid, _ = cv2.calcOpticalFlowPyrLK(gray, previous, forward, None, **LK_PARAMS)
    if back is None:
        raise LostTrack("Không xác nhận được chuyển động ở Frame này.")
    old, new = points.reshape(-1, 2), forward.reshape(-1, 2)
    good = (
        (valid.ravel() == 1)
        & (back_valid.ravel() == 1)
        & (np.linalg.norm(back.reshape(-1, 2) - old, axis=1) < LK_MAX_FORWARD_BACKWARD_PX)
        & (error.ravel() < LK_MAX_ERROR)
        & np.isfinite(new).all(axis=1)
    )
    return old, new, good


def correlation(a, b):
    """Normalised cross-correlation of two equally sized patches."""
    a, b = a - a.mean(), b - b.mean()
    return float((a * b).sum() / max(1e-6, np.linalg.norm(a) * np.linalg.norm(b)))


# --------------------------------------------------------------------------
# Trackers


class TranslationTracker:
    """Position-only tracker: LK points, robust median translation.

    Features are re-detected inside the moving ROI each frame. An appearance
    check rejects common background-lock failures when the subject disappears.
    Kept as a simpler baseline; the engine itself uses SimilarityTracker.
    """

    MIN_POINTS = 6

    def __init__(self, frame, roi):
        x, y, w, h = parse_roi(frame, roi)
        self.frames = Downscaler(frame)
        self.scale = self.frames.scale
        self.roi = np.array([x, y, w, h], dtype=np.float64) * self.scale
        self.gray = self.frames.gray(frame)
        self.points = self.features(self.gray)
        if self.points is None or len(self.points) < self.MIN_POINTS:
            raise ValueError("Vùng này ít chi tiết. Hãy chọn vùng có góc cạnh hoặc hoa văn rõ hơn.")
        self.reference = self.patch(self.gray)
        self.reference_std = float(self.reference.std())

    def features(self, gray):
        return find_corners(gray, rect_mask(gray.shape, self.roi))

    def patch(self, gray):
        x, y, w, h = self.roi
        patch = cv2.getRectSubPix(
            gray, (max(2, round(w)), max(2, round(h))), (float(x + w / 2), float(y + h / 2))
        )
        return cv2.resize(patch, (PATCH_SIZE, PATCH_SIZE)).astype(np.float32)

    def center(self):
        x, y, w, h = self.roi / self.scale
        return [float(x + w / 2), float(y + h / 2)]

    def update(self, frame):
        gray = self.frames.gray(frame)
        old, new, good = lucas_kanade(self.gray, gray, self.points)
        if int(good.sum()) < self.MIN_POINTS:
            raise LostTrack("Mất điểm bám: vật thể bị che, mờ hoặc chuyển động quá nhanh.")
        delta = new[good] - old[good]
        residual = np.linalg.norm(delta - np.median(delta, axis=0), axis=1)
        inliers = residual < max(1.5, min(3.0, float(np.median(residual)) * 2.5))
        confidence = float(inliers.sum() / len(old))
        if int(inliers.sum()) < self.MIN_POINTS or confidence < 0.45:
            raise LostTrack("Chuyển động không nhất quán. Khoanh vùng gọn hơn quanh vật thể.")
        self.roi[:2] += np.median(delta[inliers], axis=0)
        x, y, w, h = self.roi
        if x < 0 or y < 0 or x + w > gray.shape[1] or y + h > gray.shape[0]:
            raise LostTrack("Vật thể đã ra khỏi khung hình.")
        if self.reference_std > 5 and correlation(self.reference, self.patch(gray)) < 0.2:
            raise LostTrack("Hình dạng vùng bám thay đổi quá nhiều; hãy Track lại từ đây.")
        self.gray = gray
        self.points = self.features(gray)
        if self.points is None or len(self.points) < self.MIN_POINTS:
            raise LostTrack("Không còn đủ chi tiết để tiếp tục Track.")
        return self.center(), confidence


class SimilarityTracker:
    """Track a similarity transform (translation, uniform scale, rotation).

    Each frame tries, in order: LK + RANSAC, template/ECC alignment, ORB
    re-detection. `matrix` maps the initial ROI (analysis pixels) into the
    current frame.
    """

    def __init__(self, frame, roi):
        x, y, w, h = parse_roi(frame, roi)
        self.frames = Downscaler(frame)
        self.scale = self.frames.scale
        self.initial_roi = np.array([x, y, w, h], dtype=np.float64) * self.scale
        self.matrix = np.eye(3, dtype=np.float64)
        self.rotation = 0.0
        self.methods = {"flow_update": 0, "template_update": 0, "recover": 0}
        self.gray = self.frames.gray(frame)
        # Sparse regions are allowed: template/ECC can still follow them.
        self.points = find_corners(self.gray, rect_mask(self.gray.shape, self.initial_roi))
        self.reference = self.patch(self.gray)
        self.reference_std = float(self.reference.std())

    def gray_frame(self, frame):
        return self.frames.gray(frame)

    def corners(self):
        x, y, w, h = self.initial_roi
        points = np.array([[x, y, 1], [x + w, y, 1], [x + w, y + h, 1], [x, y + h, 1]])
        return (points @ self.matrix.T)[:, :2]

    def features(self, gray):
        return find_corners(gray, polygon_mask(gray.shape, self.corners()))

    def patch_grid(self):
        x, y, w, h = self.initial_roi
        return np.array(
            [[w / PATCH_SIZE, 0, x], [0, h / PATCH_SIZE, y], [0, 0, 1]], dtype=np.float64
        )

    def patch(self, gray):
        """The ROI resampled with scale/rotation undone."""
        return cv2.warpAffine(
            gray,
            (self.matrix @ self.patch_grid())[:2],
            (PATCH_SIZE, PATCH_SIZE),
            flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP,
        ).astype(np.float32)

    def center(self):
        x, y, w, h = self.initial_roi
        p = self.matrix @ np.array([x + w / 2, y + h / 2, 1])
        return (p[:2] / self.scale).tolist()

    def flow_update(self, frame):
        if self.points is None or len(self.points) < 8:
            raise LostTrack("Không đủ corner cho Optical Flow; chuyển sang Template Matching.")
        gray = self.gray_frame(frame)
        old, new, good = lucas_kanade(self.gray, gray, self.points)
        if good.sum() < 8:
            raise LostTrack("Không đủ điểm để tính Scale/Rotation. Chọn vùng rộng và rõ hơn.")
        affine, mask = cv2.estimateAffinePartial2D(
            old[good],
            new[good],
            method=cv2.RANSAC,
            ransacReprojThreshold=1.5,
            maxIters=2000,
            confidence=0.99,
            refineIters=10,
        )
        if affine is None or not np.isfinite(affine).all() or mask.sum() < 8:
            raise LostTrack("Không xác định được Scale/Rotation nhất quán.")
        confidence = float(mask.sum() / len(old))
        step_scale = math.hypot(affine[0, 0], affine[1, 0])
        step_angle = math.degrees(math.atan2(affine[1, 0], affine[0, 0]))
        spread = np.linalg.eigvalsh(np.cov(old[good][mask.ravel() == 1].T))
        if (
            confidence < 0.45
            or spread[0] < 4
            or not 0.75 < step_scale < 1.33
            or abs(step_angle) > 20
        ):
            raise LostTrack("Scale/Rotation thay đổi quá nhanh hoặc vùng Tracking thiếu chi tiết.")
        return self.accept(gray, affine, confidence)

    def accept(self, gray, affine, confidence):
        step_angle = math.degrees(math.atan2(affine[1, 0], affine[0, 0]))
        self.matrix = np.vstack([affine, [0, 0, 1]]) @ self.matrix
        self.rotation += step_angle
        corners = self.corners()
        if (
            (corners < 0).any()
            or (corners[:, 0] >= gray.shape[1]).any()
            or (corners[:, 1] >= gray.shape[0]).any()
        ):
            raise LostTrack("Vùng Tracking đã ra khỏi khung hình.")
        current = self.patch(gray)
        corr = correlation(self.reference, current)
        if self.reference_std > 5 and corr < 0.2:
            raise LostTrack("Vật thể bị che hoặc thay đổi hình dạng. Hãy Track lại từ đây.")
        self.gray = gray
        self.points = self.features(gray)
        # Adapt only after an appearance-validated frame. This follows the
        # previous-frame template principle, without learning a weak match.
        if corr >= 0.65 and confidence >= 0.65:
            self.reference = current.copy()
            self.reference_std = float(current.std())
        return self.center(), min(confidence, max(0.0, corr))

    def recover(self, frame):
        gray = self.gray_frame(frame)
        mask = polygon_mask(self.gray.shape, self.corners())
        orb = cv2.ORB_create(nfeatures=2000, edgeThreshold=8, patchSize=21, fastThreshold=7)
        old_keys, old_desc = orb.detectAndCompute(self.gray, mask)
        new_keys, new_desc = orb.detectAndCompute(gray, None)
        if old_desc is None or new_desc is None or len(new_desc) < 2:
            raise LostTrack("Không tìm lại được đặc trưng của vật thể.")
        pairs = cv2.BFMatcher(cv2.NORM_HAMMING).knnMatch(old_desc, new_desc, k=2)
        matches = [
            pair[0]
            for pair in pairs
            if len(pair) == 2 and pair[0].distance < 0.7 * pair[1].distance
        ]
        # One-to-one correspondences prevent repeated textures from inflating support.
        unique = {}
        for match in sorted(matches, key=lambda m: m.distance):
            unique.setdefault(match.trainIdx, match)
        matches = list(unique.values())
        if len(matches) < 10:
            raise LostTrack("Không đủ đặc trưng đáng tin cậy để tiếp tục Tracking.")
        old = np.float32([old_keys[m.queryIdx].pt for m in matches])
        new = np.float32([new_keys[m.trainIdx].pt for m in matches])
        affine, inliers = cv2.estimateAffinePartial2D(
            old,
            new,
            method=cv2.RANSAC,
            ransacReprojThreshold=2,
            maxIters=3000,
            confidence=0.995,
            refineIters=10,
        )
        if (
            affine is None
            or not np.isfinite(affine).all()
            or inliers.sum() < 10
            or inliers.mean() < 0.65
        ):
            raise LostTrack("Các điểm tìm lại không có chuyển động nhất quán.")
        spread = np.linalg.eigvalsh(np.cov(old[inliers.ravel() == 1].T))
        scale = math.hypot(affine[0, 0], affine[1, 0])
        if spread[0] < 9 or not 0.4 < scale < 2.5:
            raise LostTrack("Không xác nhận được Scale/Rotation sau khi tìm lại điểm.")
        return self.accept(gray, affine, float(inliers.mean()))

    def template_update(self, frame):
        """Local NCC search initializes OpenCV ECC affine image alignment.

        ECC operates on all pixels, unlike corner/descriptor-only matching.
        Project its affine result to similarity; reject shear/perspective fits.
        """
        gray = self.gray_frame(frame)
        corners = self.corners()
        lo = np.maximum(0, np.floor(corners.min(axis=0)).astype(int))
        hi = np.minimum([gray.shape[1], gray.shape[0]], np.ceil(corners.max(axis=0)).astype(int))
        w, h = hi - lo
        if min(w, h) < 8:
            raise LostTrack("Feature Region quá nhỏ để Template Matching.")
        feature = self.gray[lo[1] : hi[1], lo[0] : hi[0]]
        margin = min(240, max(24, int(max(w, h))))
        search_lo = np.maximum(0, lo - margin)
        search_hi = np.minimum([gray.shape[1], gray.shape[0]], hi + margin)
        search = gray[search_lo[1] : search_hi[1], search_lo[0] : search_hi[0]]
        scores = cv2.matchTemplate(search, feature, cv2.TM_CCOEFF_NORMED)
        _, score, _, location = cv2.minMaxLoc(scores)
        grid = self.patch_grid()
        warp = (self.matrix @ grid)[:2].astype(np.float32)
        if score >= 0.45:
            warp[:, 2] += search_lo + np.array(location) - lo
        try:
            correlation, warp = cv2.findTransformECC(
                self.reference.astype(np.uint8),
                gray,
                warp,
                cv2.MOTION_AFFINE,
                (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 60, 0.0001),
                None,
                5,
            )
        except cv2.error as error:
            raise LostTrack("Template Matching chưa hội tụ trong Search Region.") from error
        if not np.isfinite(warp).all() or correlation < 0.7:
            raise LostTrack("Template Matching có Confidence thấp.")
        candidate = np.vstack([warp, [0, 0, 1]]) @ np.linalg.inv(grid)
        step = candidate @ np.linalg.inv(self.matrix)
        u, sv, vt = np.linalg.svd(step[:2, :2])
        rotation = u @ vt
        scale = float(sv.mean())
        if np.linalg.det(rotation) < 0 or sv[1] <= 0 or sv[0] / sv[1] > 1.15 or not 0.5 < scale < 2:
            raise LostTrack("ECC cho biến dạng vượt mô hình Scale/Rotation 2D.")
        center = np.array(self.center()) * self.scale
        mapped = step[:2, :2] @ center + step[:2, 2]
        if np.linalg.norm(mapped - center) > margin * 1.5:
            raise LostTrack("Điểm tìm thấy nằm ngoài Search Region cho phép.")
        linear = rotation * scale
        affine = np.column_stack([linear, mapped - linear @ center])
        return self.accept(gray, affine, float(correlation))

    def update(self, frame):
        saved = (
            self.matrix.copy(),
            self.rotation,
            self.gray,
            self.points,
            self.reference,
            self.reference_std,
        )
        errors = []
        for method in (self.flow_update, self.template_update, self.recover):
            (
                self.matrix,
                self.rotation,
                self.gray,
                self.points,
                self.reference,
                self.reference_std,
            ) = saved
            try:
                result = method(frame)
                self.methods[method.__name__] += 1
                return result
            except (LostTrack, cv2.error, np.linalg.LinAlgError) as error:
                errors.append(str(error))
        self.matrix, self.rotation, self.gray, self.points, self.reference, self.reference_std = (
            saved
        )
        raise LostTrack(
            "Chưa xác nhận được vật thể sau Optical Flow, Template/ECC và ORB. " + errors[-1]
        )

    def estimate_next(self, frame, velocity):
        # Prediction is explicit, never presented as a measured match.
        gray = self.gray_frame(frame)
        center = np.array(self.center()) * self.scale
        delta = np.asarray(velocity, dtype=np.float64) * self.scale
        limit = np.array([gray.shape[1], gray.shape[0]]) * 0.1
        delta = np.clip(delta, -limit, limit)
        next_center = np.clip(center + delta, [0, 0], [gray.shape[1] - 1, gray.shape[0] - 1])
        self.matrix[:2, 2] += next_center - center
        self.gray = gray
        self.points = None
        # Keep the confirmed appearance template for a later recovery attempt.
        return self.center(), 0.0


def track_point(tracker, t, confidence, estimated=False):
    x, y = tracker.center()
    return dict(
        t=t,
        x=x,
        y=y,
        confidence=confidence,
        estimated=estimated,
        scale=(
            math.hypot(tracker.matrix[0, 0], tracker.matrix[1, 0])
            if isinstance(tracker, SimilarityTracker)
            else 1.0
        ),
        rotation=tracker.rotation if isinstance(tracker, SimilarityTracker) else 0.0,
    )


def run_bidirectional(request, progress=lambda event: None):
    start = number(request.get("start"), "Clip In Point")
    duration = number(request.get("duration"), "Clip duration", 0.01)
    fps = number(request.get("fps"), "FPS sequence", 1, 120)
    count = math.ceil(duration * fps - 1e-7)
    if not 2 <= count <= MAX_SAMPLES:
        raise ValueError("Clip cần từ 2 đến 1.000.000 Frame.")
    seed = round(number(request.get("seedOffset"), "Frame mốc") * fps)
    if seed < 0 or seed >= count:
        raise ValueError("Frame mốc nằm ngoài clip.")
    tracking_direction = request.get("direction", "both")
    if tracking_direction not in ("both", "forward", "backward"):
        raise ValueError("Hướng Tracking không hợp lệ.")
    low = seed if tracking_direction == "forward" else 0
    high = seed if tracking_direction == "backward" else count - 1
    total = high - low + 1
    if total < 2:
        raise ValueError("Đã ở biên clip. Chọn hướng Track khác để có ít nhất 2 Frame.")
    if request.get("mode", "position") not in ("position", "transform"):
        raise ValueError("Tracking Mode không hợp lệ.")
    video = Video(request.get("path"))
    points = [None] * count
    done, lost, display = 0, 0, seed
    methods = dict(flow_update=0, template_update=0, recover=0)
    last_progress = 0
    try:
        source_indices = [math.floor((start + i / fps) * video.fps + 1e-7) for i in range(count)]
        if source_indices[-1] >= video.count:
            raise ValueError("Đoạn Tracking vượt quá video nguồn.")
        seed_frame = video.seek(start + seed / fps)
        sample_frame = seed_frame
        # Bounded reverse decode cache: decode forward per block, consume backward.
        # Never load the entire source clip into RAM.
        cache = {}
        block = max(1, min(60, 64 * 1024 * 1024 // seed_frame.nbytes))

        def read_frame(index, direction):
            if direction > 0:
                if video.index == index - 1:
                    return video.next()
                return video.seek(index / video.fps)
            if index not in cache:
                cache.clear()
                first = max(source_indices[0], index - block + 1)
                cache[first] = video.seek(first / video.fps)
                for frame_index in range(first + 1, index + 1):
                    cache[frame_index] = video.next()
            return cache[index]

        directions = (
            (1, -1)
            if tracking_direction == "both"
            else ((1,) if tracking_direction == "forward" else (-1,))
        )
        for pass_index, direction in enumerate(directions):
            tracker = SimilarityTracker(seed_frame, request.get("roi"))
            estimated = tracker.reference_std < 1
            confidence = 0.0 if estimated else 1.0
            velocity = np.zeros(2)
            current_source = source_indices[seed]
            if pass_index == 0:
                points[seed] = track_point(tracker, seed / fps, confidence, estimated)
                done = 1
            for sample in range(seed + direction, count if direction > 0 else -1, direction):
                wanted = source_indices[sample]
                sample_estimated = estimated
                try:
                    while current_source != wanted:
                        current_source += direction
                        frame = read_frame(current_source, direction)
                        before = np.array(tracker.center())
                        was_estimated = estimated
                        try:
                            _, confidence = tracker.update(frame)
                            estimated = False
                            velocity = (
                                np.zeros(2)
                                if was_estimated
                                else np.array(tracker.center()) - before
                            )
                        except (LostTrack, cv2.error, np.linalg.LinAlgError):
                            tracker.estimate_next(frame, velocity)
                            estimated, confidence = True, 0.0
                            lost += 1
                        sample_estimated = sample_estimated or estimated
                except (ValueError, cv2.error) as error:
                    return dict(
                        complete=False,
                        reason=str(error),
                        points=[p for p in points if p is not None],
                        expected=count,
                        metadata=video.metadata(),
                        image=jpeg(sample_frame),
                        failure=dict(
                            kind="video_read_error",
                            sourceFrame=current_source,
                            engine=ENGINE_VERSION,
                        ),
                    )
                if current_source == source_indices[seed]:
                    frame = seed_frame
                elif wanted in cache and direction < 0:
                    frame = cache[wanted]
                points[sample] = track_point(
                    tracker, sample / fps, 0.0 if sample_estimated else confidence, sample_estimated
                )
                done += 1
                display, sample_frame = sample, frame
                now = time.monotonic()
                if now - last_progress >= 0.2 or sample in (0, count - 1):
                    progress(
                        dict(
                            type="progress",
                            done=done,
                            total=total,
                            index=sample - low,
                            direction="forward" if direction > 0 else "backward",
                            point=points[sample],
                            image=jpeg(frame),
                        )
                    )
                    last_progress = now
            for method, value in tracker.methods.items():
                methods[method] += value
        points = points[low : high + 1]
        for point in points:
            point["t"] -= low / fps
        return dict(
            complete=True,
            points=points,
            expected=total,
            seedIndex=seed - low,
            displayIndex=display - low,
            analyzedStartOffset=low / fps,
            direction=tracking_direction,
            methods=methods,
            estimatedFrames=sum(p["estimated"] for p in points),
            lostSourceFrames=lost,
            metadata=video.metadata(),
            image=jpeg(sample_frame),
        )
    finally:
        video.close()


def run_track(request, progress=lambda event: None):
    """Track from a seed frame. Without a seed, track forward from the clip start."""
    if "seedOffset" not in request:
        request = dict(request, seedOffset=0, direction="forward")
    return run_bidirectional(request, progress)


def handle(request):
    command = request.get("command")
    if command == "check":
        return dict(
            python=sys.version.split()[0],
            opencv=cv2.__version__,
            executable=sys.executable,
            engine=ENGINE_VERSION,
            tracking="LK + adaptive template/ECC + ORB",
        )
    if command == "preview":
        video = Video(request.get("path"))
        try:
            frame = video.seek(request.get("time", 0))
            return dict(metadata=video.metadata(), image=jpeg(frame), frame=video.index)
        finally:
            video.close()
    if command == "track":
        return run_track(request, emit)
    raise ValueError("Lệnh xử lý không hợp lệ.")


def main():
    # Preserve Vietnamese messages and media paths in the standalone executable.
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    try:
        request = json.loads(sys.stdin.readline())
        if not isinstance(request, dict):
            raise ValueError("Yêu cầu xử lý không hợp lệ.")
        emit(dict(type="result", result=handle(request)))
    except Exception as exc:
        emit(dict(type="error", message=str(exc)))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
