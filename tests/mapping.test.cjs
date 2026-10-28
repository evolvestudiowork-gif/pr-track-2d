const {test} = require('node:test');
const assert = require('node:assert/strict');
const mapping = require('../extension/js/mapping.js');
const vm = require('node:vm');
const fs = require('node:fs');

const source = {start: 10, width: 1920, height: 1080, motion: {scaleX: 50, scaleY: 50, rotation: 0}};
const target = {start: 9, end: 20, inPoint: 2, position: [0.4, 0.6]};
const result = {complete: true, points: [{t: 0, x: 100, y: 200}, {t: 1, x: 140, y: 220}]};
const options = {gain: 1, smoothing: 0, startOffset: 2};

test('mapping is exposed in CEP mixed Node/browser context', () => {
  const context = vm.createContext({window: {}, module: {exports: {}}});
  vm.runInContext(fs.readFileSync(require.resolve('../extension/js/mapping.js'), 'utf8'), context);
  assert.equal(typeof context.window.TrackMapping.createKeys, 'function');
  assert.equal(context.module.exports, context.window.TrackMapping);
});

test('trimmed timeline and target in-point map to graphic media time', () => {
  const keys = mapping.createKeys(result, source, target, options);
  assert.equal(keys[0].time, 5);
  assert.equal(keys[1].time, 6);
  assert.deepEqual(keys[0].value, target.position);
  assert.equal(keys[1].value[0], 0.4 + 20 / 1920);
  assert.equal(keys[1].value[1], 0.6 + 10 / 1080);
});
test('constant source rotation and non-uniform scale transform displacement', () => {
  const rotated = {...source, motion: {scaleX: 100, scaleY: 50, rotation: 90}};
  const value = mapping.createKeys(result, rotated, target, options)[1].value;
  assert.ok(Math.abs(value[0] - (0.4 - 10 / 1920)) < 1e-12);
  assert.ok(Math.abs(value[1] - (0.6 + 40 / 1080)) < 1e-12);
});
test('smoothing preserves the initial graphic offset', () => {
  assert.deepEqual(mapping.createKeys(result, source, target, {...options, smoothing: 2})[0].value, target.position);
});
test('partial tracks, fewer than two overlapping samples, and nonfinite values are rejected', () => {
  assert.throws(() => mapping.createKeys({...result, complete: false}, source, target, options));
  assert.throws(() => mapping.createKeys(result, source, {...target, start: 12.5}, options));
  assert.throws(() => mapping.createKeys(result, source, {...target, end: 13}, options));
  assert.throws(() => mapping.createKeys(result, source, target, {...options, gain: NaN}));
});
test('30fps clip endpoint remains end-exclusive', () => {
  const track = {complete: true, points: Array.from({length: 30}, (_, i) => ({t: i / 30, x: i, y: i}))};
  const keys = mapping.createKeys(track, {...source, start: 0}, {...target, start: 0, end: 1, inPoint: 0}, {...options, startOffset: 0});
  assert.equal(keys.length, 30);
  assert.equal(keys.at(-1).time, 29 / 30);
});


test('Scale and Rotation are relative to initial graphic values and smoothing baseline', () => {
  const r={complete:true,points:[{t:0,x:100,y:100,scale:1,rotation:179},{t:1,x:110,y:120,scale:1.2,rotation:181}]};
  const t={...target,uniform:true,scale:80,rotation:25};
  const keys=mapping.createKeys(r,source,t,{...options,transform:true});
  assert.equal(keys[0].scale,80);assert.equal(keys[0].rotation,25);
  assert.equal(keys[1].scale,96);assert.equal(keys[1].rotation,27);
  const smoothed=mapping.createKeys(r,source,t,{...options,transform:true,smoothing:2});
  assert.equal(smoothed[0].scale,80);assert.equal(smoothed[0].rotation,25);
  assert.throws(()=>mapping.createKeys(r,{...source,motion:{...source.motion,scaleY:25}},t,{...options,transform:true}));
  assert.throws(()=>mapping.createKeys(r,source,{...t,uniform:false},{...options,transform:true}));
  assert.throws(()=>mapping.createKeys(result,source,t,{...options,transform:true}));
});


test('short middle graphic receives only overlapping keys and rebases all channels', () => {
  const track={complete:true,points:Array.from({length:10},(_,i)=>({t:i,x:100+i*20,y:200+i*10,scale:1+i*0.1,rotation:i*5}))};
  const t={...target,start:13,end:16,inPoint:7,uniform:true,scale:80,rotation:25};
  const keys=mapping.createKeys(track,source,t,{...options,startOffset:0,transform:true});
  assert.equal(keys.length,3);
  assert.deepEqual(keys.map(k=>k.time),[7,8,9]);
  assert.deepEqual(keys[0].value,t.position);
  assert.equal(keys[0].scale,80);assert.equal(keys[0].rotation,25);
  assert.ok(Math.abs(keys[2].scale-80*1.5/1.3)<1e-10);
  assert.equal(keys[2].rotation,35);
  assert.equal(keys[2].value[0],t.position[0]+20/1920);
});
test('graphics overlapping either edge clip keys without writing at exclusive out point', () => {
  const track={complete:true,points:Array.from({length:10},(_,i)=>({t:i,x:i,y:i}))};
  const opts={...options,startOffset:0};
  const left=mapping.createKeys(track,source,{...target,start:8,end:13,inPoint:4},opts);
  assert.deepEqual(left.map(k=>k.time),[6,7,8]);
  const right=mapping.createKeys(track,source,{...target,start:17,end:25,inPoint:2},opts);
  assert.deepEqual(right.map(k=>k.time),[2,3,4]);
  assert.throws(()=>mapping.createKeys(track,source,{...target,start:20,end:25},opts),/2 Frame/);
});
test('overlap baseline remains stable with smoothing and 29.97 fps', () => {
  const fps=30000/1001;
  const track={complete:true,points:Array.from({length:100},(_,i)=>({t:i/fps,x:i,y:i}))};
  const t={...target,start:10+20/fps,end:10+30/fps,inPoint:3};
  const keys=mapping.createKeys(track,source,t,{...options,startOffset:0,smoothing:2});
  assert.equal(keys.length,10);
  assert.deepEqual(keys[0].value,t.position);
  assert.ok(Math.abs(keys[0].time-3)<1e-10);
  assert.ok(keys.at(-1).time<3+10/fps);
});


test('bidirectional Apply preserves seed pose, and rebases if graphic excludes seed',()=>{
  const r={complete:true,seedIndex:2,points:Array.from({length:5},(_,i)=>({t:i,x:i*20,y:i*10,scale:1+(i-2)*0.1,rotation:(i-2)*5}))};
  const t={...target,start:10,end:15,uniform:true,scale:80,rotation:25};
  const keys=mapping.createKeys(r,source,t,{...options,startOffset:0,transform:true});
  assert.deepEqual(keys[2].value,t.position);
  assert.equal(keys[2].scale,80);assert.equal(keys[2].rotation,25);
  assert.ok(keys[0].value[0]<t.position[0]);assert.equal(keys[0].rotation,15);
  const later=mapping.createKeys(r,source,{...t,start:13,end:15},{...options,startOffset:0,transform:true});
  assert.deepEqual(later[0].value,t.position);assert.equal(later[0].scale,80);assert.equal(later[0].rotation,25);
});
