const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

test('direction controls swap with Stop while tracking and reset after cancellation',async()=>{
  const html=fs.readFileSync(path.join(__dirname,'../extension/index.html'),'utf8');
  const elements={};
  for(const match of html.matchAll(/\bid="([^"]+)"/g)) elements[match[1]]={
    value:'',checked:false,hidden:false,disabled:false,events:{},parentNode:{},
    addEventListener(name,callback){this.events[name]=callback;}
  };
  elements.trackPosition.checked=true;
  const canvas=elements.preview;
  canvas.width=400;canvas.height=240;
  canvas.getContext=()=>new Proxy({}, {get:()=>()=>{}});
  canvas.getBoundingClientRect=()=>({left:0,top:0,width:400,height:240});
  canvas.setPointerCapture=()=>{};
  let rejectTrack,resolveTrack,cancelled=0; const requests=[],hostCalls=[];
  const bridge={available:true,hasBundledEngine:()=>true,configuredPython:()=>'',
    call:async method=>{hostCalls.push(method);return method==='source'?{name:'clip',nodeId:'source',sequenceId:'seq',path:'clip.mov',inPoint:0,fps:30}:method==='target'?{name:'Graphic',nodeId:'graphic',sequenceId:'seq'}:method==='finish'?{written:2,name:'Graphic'}:{startOffset:0,seedOffset:0.5,duration:1};},
    engine:async request=>(requests.push(request),request.command==='preview'?{metadata:{width:400,height:240,fps:30},frame:0,image:'mock'}:new Promise((resolve,reject)=>{resolveTrack=resolve;rejectTrack=reject;})),
    cancel(){cancelled++;rejectTrack(new Error('Stopped'));}
  };
  const context={window:{TrackBridge:bridge,TrackMapping:{createKeys:()=>[{},{}]}},document:{getElementById:id=>{
    assert.ok(elements[id],id);return elements[id];
  }},localStorage:{getItem:()=>null},setTimeout,clearTimeout,
    Image:class{constructor(){this.naturalWidth=400;this.naturalHeight=240;}set src(value){queueMicrotask(()=>this.onload());}}
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../extension/js/panel.js'),'utf8'),context);
  assert.equal(elements.cancelButton.hidden,true);
  assert.equal(elements.resetButton.disabled,true);
  elements.sourceButton.events.click();
  await new Promise(setImmediate);
  canvas.events.pointerdown({button:0,clientX:30,clientY:30,pointerId:1});
  canvas.events.pointermove({clientX:100,clientY:100});
  canvas.events.pointerup();
  assert.equal(requests[0].time,0.5);
  assert.equal(elements.trackButton.disabled,false);
  elements.trackButton.events.click();
  await new Promise(setImmediate);
  assert.equal(requests[1].start,0);
  assert.equal(requests[1].seedOffset,0.5);
  assert.equal(elements.trackDirections.hidden,true);
  assert.equal(elements.cancelButton.hidden,false);
  assert.equal(elements.cancelButton.disabled,false);
  assert.equal(elements.resetButton.disabled,true);
  elements.resetButton.events.click();
  assert.equal(elements.trackDirections.hidden,true);
  elements.cancelButton.events.click();
  assert.equal(elements.cancelButton.disabled,true);
  await new Promise(setImmediate);
  assert.equal(cancelled,1);
  assert.equal(elements.trackDirections.hidden,false);
  assert.equal(elements.cancelButton.hidden,true);
  assert.equal(elements.resetButton.disabled,false);
  const requestCount=requests.length;
  elements.trackScale.checked=true;
  elements.smooth.value='4'; elements.gain.value='2';
  await elements.resetButton.events.click();
  assert.equal(elements.clipName.textContent,'clip');
  assert.equal(elements.targetName.textContent,'Chưa chọn Graphic');
  assert.equal(elements.emptyPreview.hidden,true);
  assert.equal(elements.sourceStatus.hidden,true);
  assert.equal(elements.previewButton.disabled,false);
  assert.equal(elements.trackButton.disabled,true);
  assert.equal(elements.applyButton.disabled,true);
  assert.equal(elements.exportButton.disabled,true);
  assert.equal(elements.scrub.max,0);
  assert.equal(elements.trackPosition.checked,true);
  assert.equal(elements.trackScale.checked,true);
  assert.equal(elements.smooth.value,'4');
  assert.equal(elements.gain.value,'2');
  assert.equal(requests.length,requestCount+1);
  assert.equal(requests.at(-1).time,0.5,'Reset returns to original reference frame');
  assert.equal(hostCalls.filter(m=>m==='source').length,1,'Source is not selected again');
  // The existing Source can immediately be reselected on the canvas and tracked.
  assert.equal(elements.previewButton.disabled,false);
  assert.equal(elements.emptyPreview.hidden,true);
  canvas.events.pointerdown({button:0,clientX:30,clientY:30,pointerId:1});
  canvas.events.pointermove({clientX:100,clientY:100}); canvas.events.pointerup();
  elements.trackButton.events.click(); await new Promise(setImmediate);
  resolveTrack({complete:true,points:[{t:0,x:50,y:50},{t:1/30,x:51,y:51}],image:'mock'});
  await new Promise(setImmediate);
  elements.targetButton.events.click(); await new Promise(setImmediate);
  elements.applyButton.events.click(); await new Promise(setImmediate);
  assert.equal(elements.removeButton.disabled,false);
  assert.ok(hostCalls.includes('finish'));
  const hostCount=hostCalls.length;
  await elements.resetButton.events.click();
  assert.equal(hostCalls.length,hostCount,'Reset must not mutate Timeline');
  assert.equal(elements.clipName.textContent,'clip');
  assert.equal(elements.targetName.textContent,'Graphic');
  assert.equal(elements.applyButton.disabled,true);
  assert.equal(elements.exportButton.disabled,true);
  assert.equal(elements.removeButton.disabled,false,'Keep ability to remove last Apply');
  elements.removeButton.events.click(); await new Promise(setImmediate);
  assert.equal(hostCalls.at(-1),'remove');
  assert.equal(elements.removeButton.disabled,true);
});
