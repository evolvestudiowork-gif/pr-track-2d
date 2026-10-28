import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

import cv2
import numpy as np

ENGINE = Path(__file__).resolve().parents[1] / "extension" / "engine" / "tracker.py"
spec = importlib.util.spec_from_file_location("tracker", ENGINE)
tracker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tracker)


def synthetic_frames(count=40, vanish=None):
    rng = np.random.default_rng(17)
    patch = rng.integers(20, 240, (64, 64, 3), dtype=np.uint8)
    patch = cv2.GaussianBlur(patch, (3, 3), 0)
    frames = []
    for i in range(count):
        frame = np.full((240, 400, 3), 24, dtype=np.uint8)
        cv2.rectangle(frame, (320, 30), (360, 70), (90, 100, 110), 2)
        if vanish is None or i < vanish:
            frame[70 + i:134 + i, 50 + 2*i:114 + 2*i] = patch
        frames.append(frame)
    return frames


def transform_frames(count=35, zoom=0.006, turn=0.8):
    rng = np.random.default_rng(42)
    image = np.full((320,480,3),24,np.uint8)
    patch = cv2.GaussianBlur(rng.integers(20,240,(100,100,3),dtype=np.uint8),(3,3),0)
    image[110:210,190:290] = patch
    frames=[]
    for i in range(count):
        m=cv2.getRotationMatrix2D((240,160),-turn*i,1+zoom*i)
        m[:,2] += [i*0.7,i*0.3]
        frames.append(cv2.warpAffine(image,m,(480,320),borderValue=(24,24,24)))
    return frames


class TrackerTests(unittest.TestCase):
    def test_similarity_scale_rotation_translation(self):
        for zoom, turn in [(0.006,0.8),(-0.004,-0.8)]:
            frames=transform_frames(zoom=zoom,turn=turn)
            obj=tracker.SimilarityTracker(frames[0],[195,115,90,90])
            obj.reference=obj.patch(obj.gray)
            for i,frame in enumerate(frames[1:],1):
                obj.update(frame)
                p=tracker.track_point(obj,i/30,1)
                self.assertAlmostEqual(p['scale'],1+zoom*i,delta=0.025)
                self.assertAlmostEqual(p['rotation'],turn*i,delta=1.2)
                self.assertAlmostEqual(p['x'],240+i*0.7,delta=0.8)
                self.assertAlmostEqual(p['y'],160+i*0.3,delta=0.8)

    def test_recovery_after_large_rotation_and_scale_jump(self):
        for zoom,turn in [(0.2,30),(-0.15,-30),(0.4,15)]:
            frames=transform_frames(2,zoom,turn)
            original=tracker.SimilarityTracker(frames[0],[195,115,90,90])
            with self.assertRaises(tracker.LostTrack): original.flow_update(frames[1])
            recovered=tracker.SimilarityTracker(frames[0],[195,115,90,90])
            recovered.update(frames[1])
            point=tracker.track_point(recovered,1,1)
            self.assertAlmostEqual(point['scale'],1+zoom,delta=0.025)
            self.assertAlmostEqual(point['rotation'],turn,delta=1)
            self.assertAlmostEqual(point['x'],240.7,delta=1)
            self.assertAlmostEqual(point['y'],160.3,delta=1)

    def test_failed_recovery_keeps_last_confirmed_state(self):
        frames=transform_frames(2)
        obj=tracker.SimilarityTracker(frames[0],[195,115,90,90])
        obj.update(frames[1])
        matrix=obj.matrix.copy()
        rotation=obj.rotation
        noise=np.random.default_rng(99).integers(0,255,(320,480,3),dtype=np.uint8)
        with self.assertRaises(tracker.LostTrack): obj.update(noise)
        np.testing.assert_array_equal(obj.matrix,matrix)
        self.assertEqual(obj.rotation,rotation)

    def test_ecc_tracks_when_corner_features_are_unavailable(self):
        frames=transform_frames(2,0.025,2)
        obj=tracker.SimilarityTracker(frames[0],[195,115,90,90])
        obj.points=None
        def no_orb(frame):
            raise AssertionError('ECC should succeed before ORB')
        obj.recover=no_orb
        obj.update(frames[1])
        p=tracker.track_point(obj,1,1)
        self.assertAlmostEqual(p['x'],240.7,delta=0.6)
        self.assertAlmostEqual(p['y'],160.3,delta=0.6)
        self.assertAlmostEqual(p['scale'],1.025,delta=0.02)
        self.assertAlmostEqual(p['rotation'],2,delta=1)

    def test_adaptive_template_handles_gradual_appearance_change(self):
        rng=np.random.default_rng(23)
        patches=[cv2.GaussianBlur(rng.integers(20,240,(100,100,3),dtype=np.uint8),(3,3),0) for _ in range(2)]
        frames=[]
        for i in range(81):
            frame=np.full((320,480,3),24,np.uint8)
            patch=cv2.addWeighted(patches[0],1-i/80,patches[1],i/80,0)
            frame[110:210,150+i:250+i]=patch
            frames.append(frame)
        obj=tracker.SimilarityTracker(frames[0],[155,115,90,90])
        initial=obj.reference.copy()
        for i,frame in enumerate(frames[1:],1):
            obj.update(frame)
            self.assertAlmostEqual(obj.center()[0],200+i,delta=1)
            self.assertAlmostEqual(obj.center()[1],160,delta=1)
        a,b=initial-initial.mean(),obj.reference-obj.reference.mean()
        corr=float((a*b).sum()/(np.linalg.norm(a)*np.linalg.norm(b)))
        self.assertLess(corr,0.2)

    def test_similarity_occlusion_stops(self):
        obj=tracker.SimilarityTracker(transform_frames(1)[0],[195,115,90,90])
        with self.assertRaises(tracker.LostTrack):
            obj.update(np.full((320,480,3),24,np.uint8))

    def test_transform_video_protocol(self):
        with tempfile.TemporaryDirectory() as folder:
            video=Path(folder)/'scale rotation.avi'
            writer=cv2.VideoWriter(str(video),cv2.VideoWriter_fourcc(*'MJPG'),30,(480,320))
            self.assertTrue(writer.isOpened())
            for frame in transform_frames(): writer.write(frame)
            writer.release()
            result=tracker.run_track(dict(command='track',path=str(video),start=0,duration=1,fps=30,roi=[195,115,90,90],mode='transform'))
            self.assertTrue(result['complete'],result.get('reason'))
            last=result['points'][-1]
            self.assertAlmostEqual(last['scale'],1+0.006*29,delta=0.03)
            self.assertAlmostEqual(last['rotation'],0.8*29,delta=1.5)

    def test_position_mode_tracks_rotating_zooming_subject(self):
        frames=transform_frames(70,0.004,0.5)
        # Reproduce the old appearance rejection without changing its threshold.
        old=tracker.TranslationTracker(frames[0],[195,115,90,90])
        with self.assertRaises(tracker.LostTrack):
            for frame in frames[1:]: old.update(frame)
        with tempfile.TemporaryDirectory() as folder:
            video=Path(folder)/'position with zoom rotation.avi'
            writer=cv2.VideoWriter(str(video),cv2.VideoWriter_fourcc(*'MJPG'),30,(480,320))
            self.assertTrue(writer.isOpened())
            for frame in frames: writer.write(frame)
            writer.release()
            result=tracker.run_track(dict(path=str(video),start=0,duration=70/30,fps=30,
                                          roi=[195,115,90,90],mode='position'))
            self.assertTrue(result['complete'], result.get('reason'))
            self.assertEqual(len(result['points']),70)
            for i,p in enumerate(result['points']):
                self.assertAlmostEqual(p['x'],240+i*0.7,delta=1.0)
                self.assertAlmostEqual(p['y'],160+i*0.3,delta=1.0)

    def test_translation_with_stationary_background(self):
        frames = synthetic_frames()
        tracking = tracker.TranslationTracker(frames[0], [54, 74, 56, 56])
        initial = tracking.center()
        for i, frame in enumerate(frames[1:], 1):
            center, confidence = tracking.update(frame)
            self.assertAlmostEqual(center[0] - initial[0], 2 * i, delta=0.5)
            self.assertAlmostEqual(center[1] - initial[1], i, delta=0.5)
            self.assertGreater(confidence, 0.8)

    def test_loss_is_not_silently_extrapolated(self):
        frames = synthetic_frames(12, vanish=8)
        tracking = tracker.TranslationTracker(frames[0], [54, 74, 56, 56])
        with self.assertRaises(tracker.LostTrack):
            for frame in frames[1:]:
                tracking.update(frame)

    def test_flat_region_rejected(self):
        with self.assertRaisesRegex(ValueError, "ít chi tiết"):
            tracker.TranslationTracker(np.zeros((100, 100, 3), np.uint8), [10, 10, 60, 60])

    def test_out_of_frame_roi_rejected(self):
        with self.assertRaises(ValueError):
            tracker.TranslationTracker(synthetic_frames(1)[0], [380, 0, 40, 40])

    def test_source_fps_and_sequence_fps_with_trim(self):
        with tempfile.TemporaryDirectory() as folder:
            video = Path(folder) / "clip with spaces.avi"
            writer = cv2.VideoWriter(str(video), cv2.VideoWriter_fourcc(*"MJPG"), 30, (400, 240))
            self.assertTrue(writer.isOpened())
            for frame in synthetic_frames(40):
                writer.write(frame)
            writer.release()
            request = dict(command="track", path=str(video), start=0.2, duration=1, fps=24, roi=[66, 80, 56, 56])
            result = tracker.run_track(request)
            self.assertTrue(result["complete"], result.get("reason"))
            self.assertEqual(len(result["points"]), 24)
            initial = result["points"][0]
            for i, point in enumerate(result["points"]):
                source_index = int((0.2 + i / 24) * 30 + 1e-7)
                self.assertAlmostEqual(point["x"] - initial["x"], 2 * (source_index - 6), delta=0.8)
                self.assertAlmostEqual(point["y"] - initial["y"], source_index - 6, delta=0.8)
                self.assertAlmostEqual(point["t"], i / 24)
            proc = subprocess.run([sys.executable, str(ENGINE)], input=json.dumps(dict(command="preview", path=str(video), time=0.2)) + "\n", capture_output=True, text=True)
            self.assertEqual(proc.returncode, 0, proc.stderr)
            event = json.loads(proc.stdout)
            self.assertEqual(event["result"]["frame"], 6)
            self.assertTrue(event["result"]["image"].startswith("data:image/jpeg;base64,"))

    def test_invalid_request_is_json_error(self):
        proc = subprocess.run([sys.executable, str(ENGINE)], input='{"command":"unknown"}\n', capture_output=True, text=True)
        self.assertEqual(proc.returncode, 1)
        self.assertEqual(json.loads(proc.stdout)["type"], "error")

    def test_missing_subject_continues_to_end_with_estimated_frames(self):
        with tempfile.TemporaryDirectory() as folder:
            video=Path(folder)/'subject disappears.avi'
            writer=cv2.VideoWriter(str(video),cv2.VideoWriter_fourcc(*'MJPG'),30,(400,240))
            self.assertTrue(writer.isOpened())
            for frame in synthetic_frames(30,vanish=8): writer.write(frame)
            writer.release()
            events=[]
            result=tracker.run_track(dict(path=str(video),start=0,duration=1,fps=30,
                                          roi=[54,74,56,56]),events.append)
            self.assertTrue(result['complete'])
            self.assertEqual(len(result['points']),30)
            self.assertGreater(result['estimatedFrames'],0)
            self.assertEqual(events[-1]['done'],30)
            self.assertTrue(result['points'][-1]['estimated'])
            for p in result['points']:
                self.assertTrue(np.isfinite([p['x'],p['y'],p['scale'],p['rotation']]).all())
                if p['estimated']: self.assertEqual(p['confidence'],0)

    def test_flat_feature_can_continue_as_explicit_estimates(self):
        with tempfile.TemporaryDirectory() as folder:
            video=Path(folder)/'blank.avi'
            writer=cv2.VideoWriter(str(video),cv2.VideoWriter_fourcc(*'MJPG'),30,(400,240))
            self.assertTrue(writer.isOpened())
            for _ in range(5): writer.write(np.full((240,400,3),24,np.uint8))
            writer.release()
            result=tracker.run_track(dict(path=str(video),start=0,duration=5/30,fps=30,roi=[50,50,50,50]))
            self.assertTrue(result['complete'])
            self.assertEqual(result['estimatedFrames'],5)
            self.assertTrue(all(p['scale']==1 and p['rotation']==0 for p in result['points']))

    def test_bidirectional_trim_and_source_sequence_fps(self):
        with tempfile.TemporaryDirectory() as folder:
            video=Path(folder)/'bidirectional.avi'
            writer=cv2.VideoWriter(str(video),cv2.VideoWriter_fourcc(*'MJPG'),30,(400,240))
            self.assertTrue(writer.isOpened())
            for frame in synthetic_frames(50): writer.write(frame)
            writer.release()
            for seed in [0,12,23]:
                source_seed=int((0.2+seed/24)*30+1e-7)
                events=[]
                result=tracker.run_track(dict(path=str(video),start=0.2,duration=1,fps=24,
                    seedOffset=seed/24,roi=[54+2*source_seed,74+source_seed,56,56]),events.append)
                self.assertTrue(result['complete'])
                self.assertEqual(result['seedIndex'],seed)
                self.assertEqual(len(result['points']),24)
                self.assertEqual(events[-1]['done'],24)
                for i,point in enumerate(result['points']):
                    source_index=int((0.2+i/24)*30+1e-7)
                    self.assertAlmostEqual(point['x'],82+2*source_index,delta=0.8)
                    self.assertAlmostEqual(point['y'],102+source_index,delta=0.8)
                    self.assertAlmostEqual(point['t'],i/24)
                    self.assertFalse(point['estimated'])

    def test_bidirectional_scale_rotation_relative_to_seed(self):
        with tempfile.TemporaryDirectory() as folder:
            video=Path(folder)/'bidirectional transform.avi'
            writer=cv2.VideoWriter(str(video),cv2.VideoWriter_fourcc(*'MJPG'),30,(480,320))
            self.assertTrue(writer.isOpened())
            for frame in transform_frames(): writer.write(frame)
            writer.release()
            seed=15
            result=tracker.run_track(dict(path=str(video),start=0,duration=1,fps=30,
                seedOffset=seed/30,roi=[195+seed*0.7,115+seed*0.3,90,90],mode='transform'))
            self.assertTrue(result['complete'])
            self.assertEqual(result['points'][seed]['scale'],1)
            self.assertEqual(result['points'][seed]['rotation'],0)
            for i,p in enumerate(result['points']):
                self.assertAlmostEqual(p['scale'],(1+i*0.006)/(1+seed*0.006),delta=0.03)
                self.assertAlmostEqual(p['rotation'],(i-seed)*0.8,delta=1.5)

    def test_duration_limit(self):
        with self.assertRaises(ValueError):
            tracker.run_track(dict(start=0, duration=10000, fps=120))


if __name__ == "__main__":
    unittest.main()
