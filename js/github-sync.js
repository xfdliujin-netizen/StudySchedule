import {emptyData,validate,defaultKidPerms,defaultPins} from './database.js';
export async function privateRepositories(token){
 const found=[];
 for(let page=1;;page++){
  const response=await fetch('https://api.github.com/user/repos?visibility=private&per_page=100&page='+page,{headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token},cache:'no-store',signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw Error(response.status===401?'令牌无效或已过期，请重新填写。':'无法读取仓库，请检查网络及令牌的仓库访问权限。');
  const rows=await response.json();
  found.push(...rows.filter(r=>r.private&&!r.archived&&!r.disabled).map(r=>({owner:r.owner.login,repo:r.name})));
  if(rows.length<100)return found;
 }
}
export function merge(base,local,remote,choose){
 const result=emptyData();
 for(const group of ['tasks','exceptions','completions']){
  for(const id of new Set([...Object.keys(local[group]||{}),...Object.keys(remote[group]||{})])){
   const b=base[group]?.[id],l=local[group]?.[id],r=remote[group]?.[id];
   if(!l)result[group][id]=r;
   else if(!r||l.rev===r.rev||r.rev===b?.rev)result[group][id]=l;
   else if(l.rev===b?.rev)result[group][id]=r;
   else if(group==='completions')result[group][id]=(l.updatedAt>r.updatedAt?l:r);
   else {const selection=choose?.(group,id,l,r);if(!selection)throw Error('存在冲突，请选择保留的版本后再同步');result[group][id]=selection;}
  }
 }
 // 合并增删改审计日志（保留最近 300 条）
 const allLogs={...(remote.logs||{}),...(local.logs||{})};
 const sortedKeys=Object.keys(allLogs).sort((a,b)=>(allLogs[b].timestamp||0)-(allLogs[a].timestamp||0)).slice(0,300);
 for(const k of sortedKeys)result.logs[k]=allLogs[k];

 // 合并宝宝动态权限设置（以最新修改时间为准）
 const lp=local.kidPerms||defaultKidPerms(),rp=remote.kidPerms||defaultKidPerms();
 result.kidPerms=(lp.updatedAt||0)>=(rp.updatedAt||0)?lp:rp;

 // 合并各账号登录密码设置（以最新修改时间为准）
 const lPin=local.pins||defaultPins(),rPin=remote.pins||defaultPins();
 result.pins=(lPin.updatedAt||0)>=(rPin.updatedAt||0)?lPin:rPin;
 return result;
}
const encode=s=>{const b=new TextEncoder().encode(s);let t='';for(const v of b)t+=String.fromCharCode(v);return btoa(t);};
const decode=s=>new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g,'')),c=>c.charCodeAt(0)));
export function client(config){const root=`https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}`;const headers={Accept:'application/vnd.github+json',Authorization:`Bearer ${config.token}`,'X-GitHub-Api-Version':'2026-03-10'};
 async function request(url,options={}){
  const step=options.method==='PUT'?'上传学习记录':url===root?'验证仓库':'读取学习记录';
  let r;
  try{r=await fetch(url,{...options,headers:{...headers,...options.headers},cache:'no-store',signal:AbortSignal.timeout(25000)});}
  catch(cause){throw Error(step+'失败：'+(cause.name==='TimeoutError'?'连接 GitHub 超时，请重试。':'无法连接 api.github.com，请检查当前设备网络。'));}
  if(!r.ok){
   const body=await r.json().catch(()=>({}));
   const detail=String(body.message||'').split(config.token).join('[已隐藏]').slice(0,240);
   const e=Error(`${step}失败（HTTP ${r.status}）${detail?'：'+detail:''}`);e.status=r.status;
   const retry=r.headers?.get('retry-after'),remaining=r.headers?.get('x-ratelimit-remaining'),reset=r.headers?.get('x-ratelimit-reset');
   e.retryAfterMs=Math.max(0,retry?(Number.isFinite(Number(retry))?Number(retry)*1000:Date.parse(retry)-Date.now()):0,remaining==='0'&&reset?Number(reset)*1000-Date.now():0);
   if(r.status===429||r.status===403&&/rate limit|abuse/i.test(detail))e.retryAfterMs=Math.max(60000,e.retryAfterMs);
   throw e;
  }
  return r.json();
 }
 return {async test(){const repo=await request(root);if(!repo.private)throw Error('请选择私有数据仓库');return repo;},async pull(){try{const file=await request(root+'/contents/data/state.json');return {data:validate(JSON.parse(decode(file.content))),sha:file.sha};}catch(e){if(e.status===404){await this.test();return {data:emptyData()};}throw e;}},async push(data,sha){return request(root+'/contents/data/state.json',{method:'PUT',body:JSON.stringify({message:'Sync study planner',content:encode(JSON.stringify(data)),...(sha?{sha}:{})})});}};
}