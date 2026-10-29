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
  let rejectTrack,cancelled=0; const requests=[];
  const bridge={available:true,hasBundledEngine:()=>true,configuredPython:()=>'',
    call:async method=>method==='source'?{name:'clip',path:'clip.mov',inPoint:0,fps:30}: {startOffset:0,seedOffset:0.5,duration:1},
    engine:async request=>(requests.push(request),request.command==='preview'?{metadata:{width:400,height:240,fps:30},frame:0,image:'mock'}:new Promise((resolve,reject)=>{rejectTrack=reject;})),
    cancel(){cancelled++;rejectTrack(new Error('Stopped'));}
  };
  const context={window:{TrackBridge:bridge,TrackMapping:{}},document:{getElementById:id=>{
    assert.ok(elements[id],id);return elements[id];
  }},localStorage:{getItem:()=>null},setTimeout,clearTimeout,
    Image:class{constructor(){this.naturalWidth=400;this.naturalHeight=240;}set src(value){queueMicrotask(()=>this.onload());}}
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../extension/js/panel.js'),'utf8'),context);
  assert.equal(elements.cancelButton.hidden,true);
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
  elements.cancelButton.events.click();
  assert.equal(elements.cancelButton.disabled,true);
  await new Promise(setImmediate);
  assert.equal(cancelled,1);
  assert.equal(elements.trackDirections.hidden,false);
  assert.equal(elements.cancelButton.hidden,true);
});
