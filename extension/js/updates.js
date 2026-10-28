(function (root) {
  'use strict';
  var VERSION = '0.5.0';
  function repository(value) {
    var repo = String(value || '').trim().replace(/^https:\/\/github\.com\//i, '').replace(/\/$/, '').replace(/\.git$/, '');
    if (!/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9_.-]+$/.test(repo) || /\/\.{1,2}$/.test(repo)) throw new Error('Nhập Repository dạng owner/repo hoặc link GitHub public.');
    return repo;
  }
  function version(value) {
    var match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(String(value));
    if (!match) throw new Error('Release cần tag dạng v1.2.3 (không phải prerelease).');
    return match.slice(1).map(Number);
  }
  function newer(remote, local) {
    var a = version(remote), b = version(local);
    for (var i=0;i<3;i++) if (a[i] !== b[i]) return a[i]>b[i];
    return false;
  }
  function releaseInfo(data, repo, current, platformName) {
    repo = repository(repo);
    if (!data || data.draft || data.prerelease) throw new Error('Chưa có Release chính thức.');
    var tag = String(data.tag_name), normalized = version(tag).join('.');
    var assetName = 'PR-Track-2D-' + normalized + '-' + (platformName || 'Windows') + '-Standalone.zip';
    var packaged = Array.isArray(data.assets) && data.assets.some(function (asset) { return asset.name === assetName && asset.state === 'uploaded' && asset.size > 0; });
    return {version:normalized, newer:newer(tag,current), packaged:packaged,
      url:'https://github.com/' + repo + '/releases/tag/' + encodeURIComponent(tag)};
  }
  function check(repo, https, current, platformName) {
    repo = repository(repo);
    return new Promise(function (resolve,reject) {
      var req = https.get({hostname:'api.github.com',path:'/repos/'+repo+'/releases/latest',
        headers:{'User-Agent':'PR-Track-2D/'+VERSION,Accept:'application/vnd.github+json'}},function(res){
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(res.statusCode===404 ? 'Không tìm thấy repo public hoặc chưa có Release.' : res.statusCode===403 || res.statusCode===429 ? 'GitHub giới hạn lượt kiểm tra. Thử lại sau.' : 'GitHub trả HTTP '+res.statusCode+'.'));
        }
        var body=''; res.setEncoding('utf8');
        res.on('data',function(chunk){body+=chunk;if(body.length>2000000) req.destroy(new Error('Phản hồi GitHub quá lớn.'));});
        res.on('error',reject);
        res.on('end',function(){try {resolve(releaseInfo(JSON.parse(body),repo,current,platformName));}catch(e){reject(e);}});
      });
      var deadline = setTimeout(function(){req.destroy(new Error('Hết thời gian kết nối GitHub.'));},10000);
      req.on('close',function(){clearTimeout(deadline);});
      req.on('error',reject);
    });
  }
  var api={repository:repository,newer:newer,releaseInfo:releaseInfo,check:check};
  if (typeof module==='object' && module.exports) module.exports=api;
  if (!root || !root.document) return;
  root.TrackUpdates=api;
  var $=function(id){return root.document.getElementById(id);};
  var repoInput=$('updateRepo'), auto=$('autoUpdates'), button=$('checkUpdates'), download=$('downloadUpdate'), message=$('updateStatus');
  var releaseURL='', revision=0;
  function read(key,fallback){try{return root.localStorage.getItem(key) || fallback;}catch(e){return fallback;}}
  function save(key,value){try{root.localStorage.setItem(key,value);}catch(e){}}
  repoInput.value=read('prtrack.updateRepo',''); auto.checked=read('prtrack.autoUpdates','true')==='true';
  auto.addEventListener('change',function(){save('prtrack.autoUpdates',String(auto.checked));});
  repoInput.addEventListener('input',function(){revision++;releaseURL='';download.hidden=true;message.textContent='Bấm Check for Updates để lưu Repository.';});
  async function refresh(){
    var ticket=++revision; button.disabled=true;download.hidden=true;releaseURL='';
    try{
      var repo=repository(repoInput.value); repoInput.value=repo;save('prtrack.updateRepo',repo);
      message.textContent='Đang kiểm tra GitHub Releases…';
      var req=root.cep_node ? root.cep_node.require : (typeof require==='function' ? require : null);
      if(!req || !root.__adobe_cep__) throw new Error('Mở panel trong Premiere để kiểm tra cập nhật.');
      var runtime=req('process');
      var platformName=runtime.platform==='darwin' ? 'macOS-'+(runtime.arch==='arm64'?'arm64':'x86_64') : 'Windows';
      var info=await check(repo,req('https'),VERSION,platformName);
      if(ticket!==revision) return;
      if(info.newer && info.packaged){
        releaseURL=info.url;download.hidden=false;
        message.textContent='Có bản '+info.version+' · đang dùng '+VERSION+'. Tải ZIP, đóng Premiere rồi chạy bộ cài.';
        $('updatesPanel').open=true;
        var ancestor=$('updatesPanel').parentNode;
        while(ancestor){if(ancestor.tagName==='DETAILS') ancestor.open=true;ancestor=ancestor.parentNode;}
      }else if(info.newer){message.textContent='Release '+info.version+' chưa đính kèm ZIP standalone đúng tên.';}
      else message.textContent='Đang dùng '+VERSION+' · không có Release mới hơn.';
    }catch(e){if(ticket===revision) message.textContent='Chưa kiểm tra được: '+e.message;}
    finally{button.disabled=false;}
  }
  button.addEventListener('click',refresh);
  download.addEventListener('click',function(){
    if(!releaseURL) return;
    if(root.cep && root.cep.util && root.cep.util.openURLInDefaultBrowser) root.cep.util.openURLInDefaultBrowser(releaseURL);
    else message.textContent='Mở Release trong trình duyệt: '+releaseURL;
  });
  if(auto.checked && repoInput.value) refresh();
}(typeof window!=='undefined'?window:null));
