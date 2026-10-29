const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const code = fs.readFileSync(path.join(__dirname, '../extension/jsx/host.jsx'), 'utf8');

function setup() {
  const context = vm.createContext({});
  vm.runInContext(`
    function Time() { this.seconds = 0; }
    function File() { this.exists = true; }
    function collection(a) { a.numItems = a.length; return a; }
    function param(value) {
      return { value: value, varying: false, keys: {}, failAt: null,
        getValue: function() { return this.value; },
        setValue: function(v) { this.value = v; return 0; },
        isTimeVarying: function() { return this.varying; },
        setTimeVarying: function(v) { this.varying = v; return true; },
        areKeyframesSupported: function() { return true; },
        addKey: function(t) { this.keys[t.seconds] = (Array.isArray(this.value) ? this.value.slice() : this.value); return 0; },
        removeKey: function(t) { delete this.keys[t.seconds]; return 0; },
        setValueAtKey: function(t,v) { if (t.seconds === this.failAt) return 9; this.keys[t.seconds] = v; return 0; },
        getValueAtKey: function(t) { return this.keys[t.seconds]; },
        setInterpolationTypeAtKey: function() { return 0; },
        getKeys: function() { return Object.keys(this.keys).map(Number).sort(function(a,b){return a-b;}).map(function(v){return {seconds:v};}); }
      };
    }
    function clip(id, start, end, inPoint) {
      return { nodeId:id, name:id, mediaType:'Video', start:{seconds:start}, end:{seconds:end},
        inPoint:{seconds:inPoint}, outPoint:{seconds:inPoint+end-start},
        getSpeed:function(){return 1;}, isSpeedReversed:function(){return false;},
        projectItem:{isSequence:function(){return false;},getMediaPath:function(){return 'D:/clip.mp4';}},
        components:collection([{matchName:'AE.ADBE Motion',properties:collection([
          param([0.5,0.5]),param(100),param(100),param(true),param(0),param([0.5,0.5])
        ])}]) };
    }
    var src = clip('source',10,20,3), dst = clip('graphic',9,22,2), selected = src;
    var seq = {sequenceID:'sequence',frameSizeHorizontal:1920,frameSizeVertical:1080,timebase:'8467200000',
      getSettings:function(){return {videoPixelAspectRatio:'1:1'};},getSelection:function(){return [selected];},
      videoTracks:{numTracks:1,0:{clips:collection([src,dst])}}};
    var app={project:{activeSequence:seq}};
    var pos=dst.components[0].properties[0];
  `, context);
  vm.runInContext(code, context);
  const run = s => vm.runInContext(s, context);
  const call = (method, arg) => JSON.parse(run(`PRTrack.${method}(${arg === undefined ? '' : JSON.stringify(arg)})`));
  const source = call('source').data;
  run('selected = dst');
  const target = call('target').data;
  return {run, call, source, target, begin: n => call('begin', {source, target, count:n})};
}

test('host writes verified linear keys and restores static Position', () => {
  const h = setup();
  assert.equal(h.begin(2).ok, true);
  assert.equal(h.call('chunk', [{time:3,value:[0.5,0.5]},{time:4,value:[0.6,0.55]}]).ok, true);
  assert.equal(h.call('finish').data.written, 2);
  assert.equal(h.run('pos.varying'), true);
  assert.equal(h.call('remove').ok, true);
  assert.equal(h.run('Object.keys(pos.keys).length'), 0);
  assert.equal(h.run('pos.varying'), false);
  assert.equal(h.run('pos.value[0]'), 0.5);
});
test('write failure rolls back all keys including partially added key', () => {
  const h = setup(); h.run('pos.failAt = 4');
  assert.equal(h.begin(2).ok, true);
  assert.equal(h.call('chunk', [{time:3,value:[0.5,0.5]},{time:4,value:[0.6,0.55]}]).ok, false);
  assert.equal(h.run('Object.keys(pos.keys).length'), 0);
  assert.equal(h.run('pos.varying'), false);
});
test('source edit after analysis invalidates apply before mutation', () => {
  const h = setup(); h.run('src.components[0].properties[1].value=50');
  assert.equal(h.begin(2).ok, false);
  assert.equal(h.run('pos.varying'), false);
});
test('existing graphic Position animation is rejected', () => {
  const h = setup(); h.run('pos.varying=true;pos.keys[3]=[0.3,0.4]');
  assert.equal(h.call('target').ok, false);
  assert.equal(h.begin(2).ok, false);
  assert.equal(h.run('pos.keys[3][0]'), 0.3);
});
test('removal refuses to discard user-edited keys', () => {
  const h = setup(); h.begin(2);
  h.call('chunk', [{time:3,value:[0.5,0.5]},{time:4,value:[0.6,0.55]}]); h.call('finish');
  h.run('pos.keys[4]=[0.9,0.2]');
  assert.equal(h.call('remove').ok, false);
  assert.equal(h.run('pos.keys[4][0]'), 0.9);
});
test('target move during batch aborts and restores original property', () => {
  const h = setup(); h.begin(2);
  h.call('chunk', [{time:3,value:[0.5,0.5]}]);
  h.run('dst.start.seconds=8');
  assert.equal(h.call('chunk', [{time:4,value:[0.6,0.55]}]).ok, false);
  assert.equal(h.run('Object.keys(pos.keys).length'), 0);
  assert.equal(h.run('pos.varying'), false);
});
test('finish refuses incomplete writes and restores property', () => {
  const h = setup(); h.begin(2);
  h.call('chunk', [{time:3,value:[0.5,0.5]}]);
  assert.equal(h.call('finish').ok, false);
  assert.equal(h.run('Object.keys(pos.keys).length'), 0);
});
test('audio-linked selection is ignored while picking video', () => {
  const h = setup(); h.run("seq.getSelection=function(){return [src,{mediaType:'Audio'}];}");
  assert.equal(h.call('source').data.nodeId, 'source');
});

test('Premiere square-pixel ratio strings are accepted', () => {
  const h = setup();
  for (const ratio of ['1:1', '1/1', '1,1', ' 1 : 1 ', '100:100', '1.0', 1]) {
    h.run(`selected=src; seq.getSettings=function(){return {videoPixelAspectRatio:${JSON.stringify(ratio)}};}`);
    const response = h.call('source');
    assert.equal(response.ok, true, `ratio ${ratio}: ${response.error}`);
    assert.equal(response.data.nodeId, 'source');
  }
});

test('non-square and invalid aspect ratios still fail with the actual value', () => {
  const h = setup();
  for (const ratio of ['4:3', '10:11', '1:0', '0:0', 'unknown', '', null]) {
    h.run(`selected=src; seq.getSettings=function(){return {videoPixelAspectRatio:${JSON.stringify(ratio)}};}`);
    const response = h.call('source');
    assert.equal(response.ok, false, `ratio ${ratio}`);
    assert.ok(response.error.includes(String(ratio)));
  }
});

test('boolean success from Premiere setters supports apply and rollback', () => {
  const h = setup();
  h.run(`['setValue','addKey','removeKey','setValueAtKey','setInterpolationTypeAtKey'].forEach(function(name){
    var original=pos[name]; pos[name]=function(){original.apply(this,arguments);return true;};
  });`);
  assert.equal(h.begin(2).ok, true);
  assert.equal(h.call('chunk', [{time:3,value:[0.5,0.5]},{time:4,value:[0.6,0.55]}]).ok, true);
  assert.equal(h.call('finish').ok, true);
  assert.equal(h.call('remove').ok, true);
  assert.equal(h.run('pos.varying'), false);
  assert.equal(h.run('Object.keys(pos.keys).length'), 0);
});

test('legacy zero and void setter returns remain supported', () => {
  for (const code of ['0', 'undefined']) {
    const h = setup();
    h.run(`pos.setTimeVarying=function(v){this.varying=v;return ${code};}`);
    assert.equal(h.begin(2).ok, true);
    assert.equal(h.call('abort').ok, true);
    assert.equal(h.run('pos.varying'), false);
  }
});

test('false setter return is a failure, not numeric success zero', () => {
  const h = setup();
  h.run('pos.addKey=function(){return false;}');
  assert.equal(h.begin(2).ok, true);
  assert.equal(h.call('chunk', [{time:3,value:[0.5,0.5]}]).ok, false);
  assert.equal(h.run('pos.varying'), false);
});

test('true setter return without enabling animation fails readback', () => {
  const h = setup();
  h.run('pos.setTimeVarying=function(){return true;}');
  assert.equal(h.begin(2).ok, false);
  assert.equal(h.run('pos.varying'), false);
});

test('rollback verifies that Position actually returned to its original value', () => {
  const h = setup();
  assert.equal(h.begin(2).ok, true);
  h.run('pos.value=[0.9,0.1];pos.setValue=function(){return true;}');
  assert.equal(h.call('abort').ok, false);
});

test('null addKey return succeeds only with persisted keys at expected times', () => {
  const h = setup();
  h.run('var addOriginal=pos.addKey;pos.addKey=function(t){addOriginal.call(this,t);return null;}');
  assert.equal(h.begin(2).ok, true);
  assert.equal(h.call('chunk', [{time:3,value:[0.5,0.5]},{time:4,value:[0.6,0.55]}]).ok, true);
  assert.equal(h.call('finish').data.written, 2);
  assert.equal(h.call('remove').ok, true);
  assert.equal(h.run('Object.keys(pos.keys).length'), 0);
});

test('null addKey without persisted keys cannot report success', () => {
  const h = setup();
  h.run('pos.addKey=function(){return null;};pos.setValueAtKey=function(){return 0;};pos.getValueAtKey=function(){return [0.5,0.5];};');
  assert.equal(h.begin(2).ok, true);
  assert.equal(h.call('chunk', [{time:3,value:[0.5,0.5]},{time:4,value:[0.5,0.5]}]).ok, true);
  assert.equal(h.call('finish').ok, false);
  assert.equal(h.run('pos.varying'), false);
});

test('persisted keys at wrong times fail verification and rollback', () => {
  const h = setup();
  h.begin(2);
  h.call('chunk', [{time:3,value:[0.5,0.5]},{time:4,value:[0.6,0.55]}]);
  h.run('pos.getKeys=function(){return [{seconds:3},{seconds:4.1}];};');
  assert.equal(h.call('finish').ok, false);
  assert.equal(h.run('pos.varying'), false);
});


test('all setter return variants support complete apply and removal', () => {
  for (const result of ['null', 'undefined', 'true', '0']) {
    const h = setup();
    h.run(`['setTimeVarying','setValue','addKey','removeKey','setValueAtKey','setInterpolationTypeAtKey'].forEach(function(name){
      var original=pos[name]; pos[name]=function(){original.apply(this,arguments);return ${result};};
    });`);
    assert.equal(h.begin(2).ok, true, result);
    assert.equal(h.call('chunk', [{time:3,value:[0.5,0.5]},{time:4,value:[0.6,0.55]}]).ok, true, result);
    assert.equal(h.call('finish').data.written, 2, result);
    assert.equal(h.call('remove').ok, true, result);
    assert.equal(h.run('pos.varying'), false);
    assert.equal(h.run('Object.keys(pos.keys).length'), 0);
  }
});

test('explicit interpolation failure still rolls back', () => {
  for (const result of ['false', '9']) {
    const h = setup();
    h.run(`pos.setInterpolationTypeAtKey=function(){return ${result};};`);
    h.begin(2);
    assert.equal(h.call('chunk', [{time:3,value:[0.5,0.5]}]).ok, false);
    assert.equal(h.run('pos.varying'), false);
    assert.equal(h.run('Object.keys(pos.keys).length'), 0);
  }
});

test('null Position setter without saving value fails readback', () => {
  const h = setup();
  h.run('pos.setValueAtKey=function(){return null;};');
  h.begin(2);
  h.call('chunk', [{time:3,value:[0.5,0.5]},{time:4,value:[0.6,0.55]}]);
  assert.equal(h.call('finish').ok, false);
  assert.equal(h.run('pos.varying'), false);
});


function beginTransform(h) { return h.call('begin', {source:h.source, target:h.target, count:2, transform:true}); }
const transformKeys = [{time:3,value:[0.5,0.5],scale:100,rotation:0},{time:4,value:[0.6,0.55],scale:120,rotation:30}];
test('transform applies and removes Position Scale Rotation together', () => {
  const h=setup();
  assert.equal(beginTransform(h).ok,true);
  assert.equal(h.call('chunk',transformKeys).ok,true);
  assert.equal(h.call('finish').ok,true);
  assert.equal(h.run('dst.components[0].properties[1].keys[4]'),120);
  assert.equal(h.run('dst.components[0].properties[4].keys[4]'),30);
  assert.equal(h.call('remove').ok,true);
  for (const i of [0,1,4]) {
    assert.equal(h.run(`dst.components[0].properties[${i}].varying`),false);
    assert.equal(h.run(`Object.keys(dst.components[0].properties[${i}].keys).length`),0);
  }
});
test('Rotation failure rolls back all three channels', () => {
  const h=setup(); h.run('dst.components[0].properties[4].failAt=4');
  assert.equal(beginTransform(h).ok,true);
  assert.equal(h.call('chunk',transformKeys).ok,false);
  for (const i of [0,1,4]) assert.equal(h.run(`Object.keys(dst.components[0].properties[${i}].keys).length`),0);
  assert.equal(h.run('dst.components[0].properties[1].value'),100);
  assert.equal(h.run('dst.components[0].properties[4].value'),0);
});
test('transform refuses existing Scale animation without changing Position', () => {
  const h=setup();h.run('dst.components[0].properties[1].varying=true');
  assert.equal(beginTransform(h).ok,false);
  assert.equal(h.run('pos.varying'),false);
});
test('removal preserves user edits in Rotation', () => {
  const h=setup();beginTransform(h);h.call('chunk',transformKeys);h.call('finish');
  h.run('dst.components[0].properties[4].keys[4]=45');
  assert.equal(h.call('remove').ok,false);
  assert.equal(h.run('pos.varying'),true);
});
test('null writes without persisting Scale fail verification', () => {
  const h=setup();h.run('dst.components[0].properties[1].setValueAtKey=function(){return null;}');
  beginTransform(h);h.call('chunk',transformKeys);
  assert.equal(h.call('finish').ok,false);
  assert.equal(h.run('pos.varying'),false);
});


test('all seven channel combinations apply and reset only selected properties', () => {
  for (let mask=1;mask<8;mask++) {
    const h=setup();
    const channels={position:!!(mask&1),scale:!!(mask&2),rotation:!!(mask&4)};
    const indices=[0,1,4];
    for (let bit=0;bit<3;bit++) if (!(mask&(1<<bit))) {
      h.run(`dst.components[0].properties[${indices[bit]}].varying=true; dst.components[0].properties[${indices[bit]}].keys[7]=${bit===0?'[0.2,0.3]':'12'};`);
    }
    const target=h.call('target',{channels}).data;
    assert.ok(target, String(mask));
    assert.equal(h.call('begin',{source:h.source,target,count:2,channels}).ok,true,String(mask));
    assert.equal(h.call('chunk',transformKeys).ok,true,String(mask));
    assert.equal(h.call('finish').ok,true,String(mask));
    assert.equal(h.call('remove').ok,true,String(mask));
    for (let bit=0;bit<3;bit++) {
      const selected=!!(mask&(1<<bit));
      assert.equal(h.run(`dst.components[0].properties[${indices[bit]}].varying`),!selected,String(mask));
      assert.equal(h.run(`Object.keys(dst.components[0].properties[${indices[bit]}].keys).length`),selected?0:1,String(mask));
    }
  }
});
test('empty channel selection cannot mutate graphic', () => {
  const h=setup();
  assert.equal(h.call('begin',{source:h.source,target:h.target,count:2,channels:{}}).ok,false);
  assert.equal(h.run('pos.varying'),false);
});


test('range covers trimmed clip and keeps playhead as seed even near clip end', () => {
  const h=setup();
  h.run('selected=src;src.end.seconds=310;src.outPoint.seconds=303;seq.getPlayerPosition=function(){return {seconds:15};};');
  const source=h.call('source').data;
  const result=h.call('range',{source});
  assert.equal(result.ok,true);
  assert.equal(result.data.startOffset,0);
  assert.equal(result.data.seedOffset,5);
  assert.equal(result.data.duration,300);
  h.run('seq.getPlayerPosition=function(){return {seconds:9};};');
  assert.equal(h.call('range',{source}).ok,false);
  h.run('seq.getPlayerPosition=function(){return {seconds:310};};');
  assert.equal(h.call('range',{source}).ok,false);
  h.run('seq.getPlayerPosition=function(){return {seconds:309.98};};');
  const last=h.call('range',{source});
  assert.equal(last.ok,true);
  assert.ok(last.data.seedOffset<300);
});


test('short graphic overlap maps through real host transaction and Reset', () => {
  const h=setup();
  h.run('dst.start.seconds=12;dst.end.seconds=14;dst.inPoint.seconds=5;dst.outPoint.seconds=7;');
  const target=h.call('target').data;
  const mapping=require('../extension/js/mapping.js');
  const result={complete:true,points:Array.from({length:10},(_,i)=>({t:i,x:100+i*10,y:100+i*5}))};
  const keys=mapping.createKeys(result,h.source,target,{gain:1,smoothing:0,startOffset:0});
  assert.deepEqual(keys.map(k=>k.time),[5,6]);
  assert.equal(h.call('begin',{source:h.source,target,count:keys.length}).ok,true);
  assert.equal(h.call('chunk',keys).ok,true);
  assert.equal(h.call('finish').data.written,2);
  assert.equal(h.call('remove').ok,true);
  assert.equal(h.run('Object.keys(pos.keys).length'),0);
});


test('stored target is refreshed and applied by ID even when source is selected',()=>{
 const h=setup();h.run('selected=src');
 const target=h.call('target',{nodeId:h.target.nodeId,sequenceId:h.target.sequenceId,channels:{position:true}});
 assert.equal(target.ok,true);assert.equal(target.data.nodeId,'graphic');
 assert.equal(h.call('begin',{source:h.source,target:target.data,count:2}).ok,true);
 assert.equal(h.call('chunk',[{time:3,value:[0.5,0.5]},{time:4,value:[0.6,0.55]}]).ok,true);
 assert.equal(h.call('finish').ok,true);
 assert.equal(h.call('remove').ok,true);
});
test('stored target rejects another sequence or deleted clip',()=>{
 const h=setup();
 assert.equal(h.call('target',{nodeId:h.target.nodeId,sequenceId:'different'}).ok,false);
 assert.equal(h.call('target',{nodeId:'deleted',sequenceId:h.target.sequenceId}).ok,false);
 assert.equal(h.run('pos.varying'),false);
});
