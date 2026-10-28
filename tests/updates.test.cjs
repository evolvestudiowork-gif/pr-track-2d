const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const updates=require('../extension/js/updates.js');
const release=(tag='v0.5.0')=>({tag_name:tag,draft:false,prerelease:false,assets:[{name:'PR-Track-2D-'+tag.slice(1)+'-Windows-Standalone.zip',state:'uploaded',size:100}]});
test('repository normalization rejects arbitrary hosts and URL injection',()=>{
  assert.equal(updates.repository('https://github.com/owner/pr-track-2d.git'),'owner/pr-track-2d');
  for(const input of ['https://evil.test/a/b','a/b?token=secret','a/../b','a/b/releases','a/b#x','']) assert.throws(()=>updates.repository(input));
});
test('release version comparison is numeric and requires the standalone installer asset',()=>{
  assert.equal(updates.newer('v0.10.0','0.9.9'),true);
  assert.equal(updates.newer('v0.4.2','0.4.2'),false);
  assert.equal(updates.newer('v0.4.1','0.4.2'),false);
  assert.throws(()=>updates.newer('v1.0.0-beta','0.4.2'));
  const info=updates.releaseInfo({...release(),html_url:'https://evil.test'},'owner/repo','0.4.2');
  assert.equal(info.url,'https://github.com/owner/repo/releases/tag/v0.5.0');
  assert.equal(info.packaged,true);
  assert.equal(updates.releaseInfo({...release(),assets:[]},'owner/repo','0.4.2').packaged,false);
  assert.throws(()=>updates.releaseInfo({...release(),prerelease:true},'owner/repo','0.4.2'));
  assert.throws(()=>updates.releaseInfo({...release(),draft:true},'owner/repo','0.4.2'));
});
function transport(status,body){return {get(options,callback){
  assert.equal(options.hostname,'api.github.com');assert.equal(options.path,'/repos/owner/repo/releases/latest');
  const req=new EventEmitter();req.destroy=e=>{req.emit('error',e);req.emit('close');};
  setImmediate(()=>{
    const res=new EventEmitter();res.statusCode=status;res.setEncoding=()=>{};res.resume=()=>{};
    callback(res);
    if(status===200){res.emit('data',body);res.emit('end');}
    req.emit('close');
  });return req;
}};}
test('GitHub transport handles success, missing release, rate limit and malformed JSON',async()=>{
  assert.equal((await updates.check('owner/repo',transport(200,JSON.stringify(release())),'0.4.2')).newer,true);
  await assert.rejects(updates.check('owner/repo',transport(404,''),'0.4.2'),/Release/);
  await assert.rejects(updates.check('owner/repo',transport(403,''),'0.4.2'),/giới hạn/);
  await assert.rejects(updates.check('owner/repo',transport(200,'bad json'),'0.4.2'));
});


test('macOS updater requires the matching architecture asset',()=>{
 const data=release();
 assert.equal(updates.releaseInfo(data,'owner/repo','0.5.0','macOS-arm64').packaged,false);
 data.assets.push({name:'PR-Track-2D-0.5.0-macOS-arm64-Standalone.zip',state:'uploaded',size:100});
 assert.equal(updates.releaseInfo(data,'owner/repo','0.4.0','macOS-arm64').packaged,true);
 assert.equal(updates.releaseInfo(data,'owner/repo','0.4.0','macOS-x86_64').packaged,false);
});
