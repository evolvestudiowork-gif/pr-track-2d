"""Exercise the relocated exe with no Python on PATH, including actual tracking."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / 'tests'))
from test_tracker import synthetic_frames, transform_frames
import cv2

with tempfile.TemporaryDirectory(prefix='PR Track tiếng Việt ') as folder:
    directory = Path(folder)
    runtime = directory / 'runtime'
    shutil.copytree(root / ('build/macos-extension/runtime' if sys.platform=='darwin' else 'extension/runtime'), runtime, symlinks=True)
    executable = runtime / ('PRTrackEngine' if sys.platform=='darwin' else 'PRTrackEngine.exe')
    env = {k: v for k, v in os.environ.items() if not k.upper().startswith('PYTHON')}
    env['PATH'] = '/usr/bin:/bin' if sys.platform=='darwin' else str(Path(os.environ['SystemRoot']) / 'System32')
    def request(data, expected=0):
        proc = subprocess.run([str(executable)], input=json.dumps(data, ensure_ascii=False)+'\n',
                              text=True, encoding='utf-8', capture_output=True, cwd=directory,
                              env=env, timeout=45)
        assert proc.returncode == expected, proc.stderr + proc.stdout[-1000:]
        events = [json.loads(line) for line in proc.stdout.splitlines()]
        return events
    result = request({'command':'check'})[-1]['result']
    assert Path(result['executable']).resolve() == executable.resolve()
    video = directory / 'cảnh thử có dấu.avi'
    writer = cv2.VideoWriter(str(video), cv2.VideoWriter_fourcc(*'MJPG'), 30, (400,240))
    assert writer.isOpened()
    for frame in synthetic_frames(40):
        writer.write(frame)
    writer.release()
    preview = request({'command':'preview','path':str(video),'time':0.2})[-1]['result']
    assert preview['frame'] == 6 and preview['image'].startswith('data:image/jpeg;base64,')
    events = request({'command':'track','path':str(video),'start':0.2,'duration':1,'fps':24,'roi':[66,80,56,56]})
    track = events[-1]['result']
    assert track['complete'] and len(track['points']) == 24
    assert any(e['type'] == 'progress' for e in events)
    first = track['points'][0]
    for i, point in enumerate(track['points']):
        offset = int((0.2+i/24)*30+1e-7)-6
        assert abs(point['x']-first['x']-2*offset) < 0.8
        assert abs(point['y']-first['y']-offset) < 0.8
    assert request({'command':'unknown'}, 1)[-1]['type'] == 'error'
    transformed = directory / 'Scale Rotation.avi'
    writer = cv2.VideoWriter(str(transformed),cv2.VideoWriter_fourcc(*'MJPG'),30,(480,320))
    assert writer.isOpened()
    for frame in transform_frames(): writer.write(frame)
    writer.release()
    motion = request({'command':'track','path':str(transformed),'start':0,'duration':1,
                      'fps':30,'roi':[195,115,90,90],'mode':'transform'})[-1]['result']
    assert motion['complete'] and len(motion['points']) == 30
    assert abs(motion['points'][-1]['scale']-1.174)<0.03
    assert abs(motion['points'][-1]['rotation']-23.2)<1.5
    position = request({'command':'track','path':str(transformed),'start':0,'duration':1,
                        'fps':30,'roi':[195,115,90,90],'mode':'position'})[-1]['result']
    assert position['complete'] and len(position['points']) == 30
    jump = directory / 'rotation jump.avi'
    writer=cv2.VideoWriter(str(jump),cv2.VideoWriter_fourcc(*'MJPG'),30,(480,320))
    assert writer.isOpened()
    for frame in transform_frames(2,0.2,30): writer.write(frame)
    writer.release()
    recovered=request({'command':'track','path':str(jump),'start':0,'duration':2/30,'fps':30,
                       'roi':[195,115,90,90],'mode':'transform'})[-1]['result']
    assert recovered['complete']
    assert abs(recovered['points'][-1]['rotation']-30)<2
    assert abs(recovered['points'][-1]['scale']-1.2)<0.03
    missing=directory/'missing subject.avi'
    writer=cv2.VideoWriter(str(missing),cv2.VideoWriter_fourcc(*'MJPG'),30,(400,240))
    assert writer.isOpened()
    for frame in synthetic_frames(30,vanish=8): writer.write(frame)
    writer.release()
    continued=request({'command':'track','path':str(missing),'start':0,'duration':1,'fps':30,'roi':[54,74,56,56]})[-1]['result']
    assert continued['complete'] and len(continued['points'])==30 and continued['estimatedFrames']>0
    assert continued['points'][-1]['estimated']
    both=request({'command':'track','path':str(video),'start':0.2,'duration':1,'fps':24,'seedOffset':0.5,'roi':[96,95,56,56]})[-1]['result']
    assert both['complete'] and len(both['points'])==24 and both['seedIndex']==12
    for i,point in enumerate(both['points']):
        source_index=int((0.2+i/24)*30+1e-7)
        assert abs(point['x']-(124+2*(source_index-21)))<1
    print('PASS: standalone bidirectional tracking from middle seed, trimmed input and mixed FPS.')
    print('PASS: standalone continues to final frame after subject disappears; Estimated frames flagged.')
    print('PASS: standalone ORB recovery from 30-degree rotation and 20-percent scale jump.')
    print('PASS: standalone Position and Scale/Rotation on rotating/zooming footage, 30 frames.')
    print('PASS: relocated runtime; no Python on PATH; Unicode paths; check/preview/24-frame tracking/errors.')
