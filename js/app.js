import {homeBoard} from './home-board.js';
import {allTodayDone,fireworks} from './celebration.js';
import {learningView,nearbyDays,relativeDay} from './view-model.js';
import {subjects,today,instances,repeatLabel,shiftDate} from './repeat-engine.js';
import {openDB,read,write,emptyData,validate} from './database.js';
import {saveTask,deleteTask,complete} from './task-manager.js';
import {client,merge,privateRepositories} from './github-sync.js';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data=emptyData(),base=emptyData(),config={},subject='all',filter='all',date=today(),busy=false,status='本地模式',timer,screen='tasks',storageFailed=false;
const dialog=$('#editor');
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(timer);timer=setTimeout(()=>$('#toast').classList.remove('show'),4000);}
let syncTimer;
async function persist(){try{await write('data',data);storageFailed=false;status=config.token?'等待同步':'已保存到本机';clearTimeout(syncTimer);syncTimer=setTimeout(sync,1500);}catch(e){storageFailed=true;status='保存失败';toast('本机存储失败，请立即导出备份，避免关闭页面。');}render();}

const themes={
  all:{
    name:'首页',icon:'☀',subtitle:'学习计划',
    art:`<svg class="hero-svg" viewBox="0 0 220 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="165" cy="70" r="55" fill="url(#homeGlow)" opacity="0.55"/>
      <circle cx="165" cy="70" r="38" stroke="currentColor" stroke-opacity="0.15" stroke-width="1.5" stroke-dasharray="4 4"/>
      <path d="M95 115 C125 65, 165 45, 210 30" stroke="url(#homeLine)" stroke-width="2.5" stroke-linecap="round"/>
      <g class="floating-badge" transform="translate(135, 32)">
        <rect x="0" y="0" width="56" height="56" rx="18" fill="white" fill-opacity="0.78" stroke="white" stroke-width="1.5"/>
        <path d="M28 12L32.5 23.5L44 28L32.5 32.5L28 44L23.5 32.5L12 28L23.5 23.5L28 12Z" fill="url(#starGrad)"/>
      </g>
      <circle cx="112" cy="88" r="5" fill="#3B82F6" fill-opacity="0.4"/>
      <circle cx="195" cy="98" r="3.5" fill="#6366F1" fill-opacity="0.5"/>
      <defs>
        <radialGradient id="homeGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(165 70) scale(55)">
          <stop stop-color="#60A5FA"/><stop offset="1" stop-color="#60A5FA" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="homeLine" x1="95" y1="115" x2="210" y2="30" gradientUnits="userSpaceOnUse">
          <stop stop-color="#3B82F6" stop-opacity="0"/><stop offset="0.5" stop-color="#3B82F6" stop-opacity="0.45"/><stop offset="1" stop-color="#6366F1" stop-opacity="0.8"/>
        </linearGradient>
        <linearGradient id="starGrad" x1="12" y1="12" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stop-color="#2563EB"/><stop offset="1" stop-color="#7C3AED"/>
        </linearGradient>
      </defs>
    </svg>`
  },
  chinese:{
    name:'语文',icon:'文',subtitle:'阅读 · 积累 · 表达',tag:'诗书山海',
    art:`<svg class="hero-svg" viewBox="0 0 220 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M60 130 Q105 75 150 130 Z" fill="#D97706" fill-opacity="0.1"/>
      <path d="M110 130 Q160 55 215 130 Z" fill="#B45309" fill-opacity="0.14"/>
      <circle cx="178" cy="40" r="22" fill="#F59E0B" fill-opacity="0.22"/>
      <g transform="translate(118, 28)">
        <rect x="0" y="8" width="68" height="82" rx="12" transform="rotate(-6 0 8)" fill="white" fill-opacity="0.75" stroke="#F59E0B" stroke-opacity="0.3" stroke-width="1.5"/>
        <line x1="18" y1="24" x2="18" y2="72" stroke="#D97706" stroke-opacity="0.35" stroke-width="2" stroke-linecap="round"/>
        <line x1="34" y1="22" x2="34" y2="70" stroke="#D97706" stroke-opacity="0.35" stroke-width="2" stroke-linecap="round"/>
        <line x1="50" y1="20" x2="50" y2="68" stroke="#D97706" stroke-opacity="0.35" stroke-width="2" stroke-linecap="round"/>
        <rect x="42" y="48" width="36" height="36" rx="10" fill="#B45309" fill-opacity="0.9"/>
        <text x="60" y="73" text-anchor="middle" fill="#FFFBEB" font-size="20" font-weight="700" font-family="serif">文</text>
      </g>
    </svg>`
  },
  math:{
    name:'数学',icon:'π',subtitle:'计算 · 思考 · 探索',tag:'逻辑宇宙',
    art:`<svg class="hero-svg" viewBox="0 0 220 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="160" cy="70" r="52" stroke="#7C3AED" stroke-opacity="0.14" stroke-width="1.5" stroke-dasharray="5 5"/>
      <polygon points="155,18 202,98 110,98" fill="#8B5CF6" fill-opacity="0.1" stroke="#7C3AED" stroke-opacity="0.3" stroke-width="1.5" stroke-linejoin="round"/>
      <g transform="translate(105, 32)">
        <rect x="0" y="18" width="54" height="54" rx="16" transform="rotate(-10 0 18)" fill="white" fill-opacity="0.82" stroke="#8B5CF6" stroke-opacity="0.3" stroke-width="1.5"/>
        <text x="27" y="54" text-anchor="middle" fill="#6D28D9" font-size="30" font-weight="800" font-family="serif" transform="rotate(-10 27 45)">π</text>
      </g>
      <g transform="translate(154, 62)">
        <rect x="0" y="0" width="52" height="30" rx="9" fill="#6D28D9" fill-opacity="0.88"/>
        <text x="26" y="19" text-anchor="middle" fill="white" font-size="11" font-weight="700">a²+b²=c²</text>
      </g>
    </svg>`
  },
  english:{
    name:'英语',icon:'Aa',subtitle:'听力 · 朗读 · 阅读',tag:'世界对话',
    art:`<svg class="hero-svg" viewBox="0 0 220 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="162" cy="70" r="48" fill="#10B981" fill-opacity="0.1"/>
      <g transform="translate(104, 24)">
        <rect x="0" y="0" width="76" height="46" rx="16" fill="white" fill-opacity="0.85" stroke="#10B981" stroke-opacity="0.3" stroke-width="1.5"/>
        <path d="M18 46 L12 56 L28 46 Z" fill="white" fill-opacity="0.85"/>
        <text x="38" y="29" text-anchor="middle" fill="#047857" font-size="16" font-weight="800">Hello!</text>
      </g>
      <g transform="translate(142, 62)">
        <rect x="0" y="0" width="62" height="44" rx="14" fill="#059669" fill-opacity="0.9"/>
        <path d="M46 44 L54 53 L36 44 Z" fill="#059669" fill-opacity="0.9"/>
        <text x="31" y="29" text-anchor="middle" fill="white" font-size="18" font-weight="800">Aa</text>
      </g>
    </svg>`
  }
};

function render(){
 const theme=themes[subject],view=learningView(data,subject,date),rows=view.rows;
 const day=relativeDay(date),home=subject==='all';
 $('#app').className='theme-'+(screen==='settings'?'all':subject);
 $('#app').innerHTML=`<aside><a class="brand" href="#"><span>✦</span><div>小小学习家</div></a><div class="nav-caption">学习空间</div><nav aria-label="学习导航">${Object.entries(themes).map(([id,s])=>{const n=id==='all'?0:learningView(data,id,date).pending;return `<button data-sub="${id}" class="${subject===id&&screen==='tasks'?'active':''}"><span class="nav-icon icon-${id}">${s.icon}</span><span>${s.name}</span>${n?`<b>${n}</b>`:''}</button>`;}).join('')}</nav><div class="aside-bottom"><button id="settings">⚙ 设置与同步</button><small>${esc(status)}</small></div></aside><main><header><span>${screen==='settings'?'设置':home?'首页':'学科计划 / '+theme.name}</span><div><button id="mobile-settings" aria-label="设置">⚙</button><button id="sync">☁ ${esc(status)}</button></div></header>${screen==='settings'?settingsHTML():`${home?`<section class="hero-banner hero-home"><div class="hero-content"><div class="hero-badges"><span class="hero-pill">✦ 今日闪闪发光</span><span class="hero-monogram">LYC SPACE</span></div><h1>刘诣辰的学习计划</h1><p class="hero-sub">专属学习空间 · 每一步都算数</p></div><div class="hero-visual" aria-hidden="true">${themes.all.art}</div></section>`:`<section class="hero-banner hero-${subject}"><div class="hero-content"><div class="hero-badges"><span class="hero-pill">0${['chinese','math','english'].indexOf(subject)+1} · ${theme.tag}</span></div><h1>${theme.name}<span>学习计划</span></h1><p class="hero-sub">${theme.subtitle}</p></div><div class="hero-visual" aria-hidden="true">${theme.art}</div></section>`}
 <section class="day-planner" aria-label="日期计划"><div class="planner-heading"><h2>${home?'这几天的安排':'学习日历'}</h2><label class="date">选择日期 <input type="date" id="date" value="${date}" aria-label="查看日期"></label></div><div class="day-tabs">${nearbyDays(data).map(d=>{const count=home?d.count:learningView(data,subject,d.date).total;return `<button data-date="${d.date}" class="${d.date===date?'selected':''}" aria-pressed="${d.date===date}"><span>${d.label}</span><small>${Number(d.date.slice(5,7))}/${Number(d.date.slice(8))}</small><em>${count} 项计划</em></button>`;}).join('')}</div></section>
 <section class="stats" aria-label="${home?'全部科目':theme.name}统计"><button class="stat warm" data-filter="pending"><span>待学习</span><strong>${view.pending}<small> 项</small></strong></button><button class="stat green" data-filter="done"><span>${esc(day)}已学习</span><strong>${view.done}<small> 项</small></strong></button><div class="stat progress"><span>${esc(day)}进度 <b>${view.percent}%</b></span><div class="track"><i style="width:${view.percent}%"></i></div><small>${view.done} / ${view.total} 项完成</small></div></section>
 ${home?homeBoard(data,date):`<section class="workspace subject-workspace"><div class="section-head"><div><h2>${esc(day)}${theme.name}任务</h2><p>${view.total} 项当日计划${date===today()?' · 含往期待办':''}</p></div><button class="primary" id="add">＋ 添加任务</button></div><div class="toolbar"><div class="filters">${[['all','全部'],['pending','待学习'],['done','已学习']].map(([id,name])=>`<button data-filter="${id}" class="${filter===id?'selected':''}">${name}</button>`).join('')}</div></div><div class="cards">${rows.filter(t=>filter==='all'||(filter==='done'?t.done:!t.done)).map(cardHTML).join('')||`<div class="empty"><span class="empty-symbol">${theme.icon}</span><h3>${filter==='done'?'暂无已完成任务':'暂无'+theme.name+'任务'}</h3><p>${filter==='done'?'完成任务后会显示在这里':'点击添加任务，安排'+esc(day)+'的学习'}</p></div>`}</div>${pausedHTML()}</section>`}`}</main><nav class="mobile-nav" aria-label="底部导航">${Object.entries(themes).map(([id,s])=>`<button data-sub="${id}" class="${subject===id&&screen==='tasks'?'active':''}"><span class="nav-icon icon-${id}">${s.icon}</span><small>${s.name}</small></button>`).join('')}</nav>`;
 document.querySelectorAll('[data-sub]').forEach(b=>b.onclick=()=>{subject=b.dataset.sub;screen='tasks';filter='all';render();});
 document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;screen='tasks';render();});
 document.querySelectorAll('[data-date]').forEach(b=>b.onclick=()=>{date=b.dataset.date;filter='all';render();});
 document.querySelectorAll('.mobile-nav [data-sub]').forEach(b=>{const id=b.dataset.sub;if(id!=='all'){const n=learningView(data,id,date).pending;if(n){const badge=document.createElement('b');badge.className='mobile-badge';badge.textContent=n;b.append(badge);}}});
 const openSettings=()=>{screen='settings';render();};$('#settings').onclick=openSettings;$('#mobile-settings').onclick=openSettings;if($('#board-settings'))$('#board-settings').onclick=openSettings;$('#sync').onclick=sync;
 if(screen==='settings')bindSettings();else{
  if($('#add'))$('#add').onclick=()=>edit();$('#date').onchange=e=>{if(e.target.value){date=e.target.value;filter='all';render();}};
  document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{const t=rows.find(t=>t.key===b.dataset.key);if(b.dataset.action==='complete'){const wasDone=allTodayDone(data);complete(data,t);persist().then(()=>{if(!storageFailed&&!wasDone&&t.date===today()&&allTodayDone(data))fireworks();else if(!t.done)toast('完成了！🌟');});}if(b.dataset.action==='edit')edit(t);if(b.dataset.action==='delete')remove(t);});
  document.querySelectorAll('[data-resume]').forEach(b=>b.onclick=()=>edit({...data.tasks[b.dataset.resume],date}));
 }
}
function cardHTML(t){const s=subjects.find(s=>s.id===t.subjectId);return `<article class="task ${t.done?'completed':''}"><button class="check" data-action="complete" data-key="${esc(t.key)}" aria-label="${t.done?'撤销完成':'完成任务'}">${t.done?'✓':''}</button><div class="task-body"><div class="task-actions"><button data-action="edit" data-key="${esc(t.key)}" aria-label="编辑任务">编辑</button><button data-action="delete" data-key="${esc(t.key)}" aria-label="删除任务">删除</button></div><h3>${esc(t.title)}</h3>${t.description?`<p>${esc(t.description)}</p>`:''}<div class="meta"><span>📅 ${t.date}</span><span>↻ ${esc(repeatLabel(t.repeatRule))}</span></div>${t.done?`<small>完成于 ${esc(new Date(t.completedAt).toLocaleString('zh-CN'))}</small>`:''}</div></article>`;}
function pausedHTML(){const tasks=Object.values(data.tasks).filter(t=>!t.deleted&&(!t.enabled||t.startDate>date)&&(subject==='all'||t.subjectId===subject));return tasks.length?`<details class="plans"><summary>暂停 / 未来计划（${tasks.length}）</summary>${tasks.map(t=>`<p>${esc(t.title)} · ${t.enabled?t.startDate+' 开始':'已暂停'} <button data-resume="${esc(t.id)}">管理计划</button></p>`).join('')}</details>`:'';}
function show(content){dialog.innerHTML=content;dialog.showModal();dialog.querySelector('[data-close]')?.addEventListener('click',()=>dialog.close());}
function edit(t){const initial=t||{subjectId:subject==='all'?'chinese':subject,title:'',description:'',startDate:date,endDate:'',durationMinutes:20,reminderTime:'',enabled:true,repeatRule:{type:'daily',days:[1,3,5],interval:2}};show(`<form id="task-form"><div class="modal-head"><h2>${t?'编辑学习计划':'添加学习任务'}</h2><button type="button" data-close aria-label="关闭">✕</button></div><label>任务名称<input name="title" required maxlength="100" value="${esc(initial.title)}" placeholder="例如：课外阅读 20 分钟"></label><div class="form-row"><label>科目<select name="subjectId">${subjects.map(s=>`<option value="${s.id}" ${s.id===initial.subjectId?'selected':''}>${s.name}</option>`).join('')}</select></label></div><label>学习内容<textarea name="description" maxlength="2000" rows="3" placeholder="今天准备学习什么？">${esc(initial.description)}</textarea></label><div class="form-row"><label>重复方式<select id="repeat" name="repeat">${[['once','仅一次'],['daily','每天'],['weekly','每周（自定义）'],['interval','每隔 N 天']].map(([v,n])=>`<option value="${v}" ${v===initial.repeatRule.type?'selected':''}>${n}</option>`).join('')}</select></label></div><div id="weekly" class="weekdays">${[0,1,2,3,4,5,6].map(d=>`<label><input type="checkbox" name="days" value="${d}" ${initial.repeatRule.days?.includes(d)?'checked':''}><span>${'日一二三四五六'[d]}</span></label>`).join('')}</div><label id="interval">间隔天数<input name="interval" type="number" min="1" max="3650" value="${initial.repeatRule.interval||2}"></label><label class="inline"><input name="enabled" type="checkbox" ${initial.enabled?'checked':''}> 启用此计划</label>${t?'<label>修改范围<select name="scope"><option value="day">仅修改此执行日</option><option value="future">此执行日及以后的计划</option></select></label>':''}<button class="primary full">保存学习计划</button></form>`);
const update=()=>{$('#weekly').hidden=$('#repeat').value!=='weekly';$('#interval').hidden=$('#repeat').value!=='interval';};$('#repeat').onchange=update;update();$('#task-form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),rule={type:f.get('repeat'),days:f.getAll('days').map(Number),interval:Number(f.get('interval'))};if(rule.type==='weekly'&&!rule.days.length)return toast('请至少选择一个星期');if(rule.type==='interval'&&(!Number.isInteger(rule.interval)||rule.interval<1))return toast('请输入有效的间隔天数');saveTask(data,{title:f.get('title').trim(),description:f.get('description'),subjectId:f.get('subjectId'),startDate:initial.startDate,endDate:initial.endDate||'',reminderTime:initial.reminderTime||'',durationMinutes:initial.durationMinutes||20,repeatRule:rule,enabled:f.has('enabled')},t,t?.date,f.get('scope'));await persist();dialog.close();};}
function remove(t){show(`<form id="delete-form"><div class="modal-head"><h2>删除学习任务</h2><button type="button" data-close>✕</button></div><p>确定删除「${esc(t.title)}」？历史完成记录会保留。</p><label>删除范围<select name="scope"><option value="day">仅删除此执行日</option><option value="future">终止此执行日及后续计划</option><option value="series">删除整个任务系列</option></select></label><button class="danger full">确认删除</button></form>`);$('#delete-form').onsubmit=async e=>{e.preventDefault();deleteTask(data,t.id,t.date,new FormData(e.target).get('scope'));await persist();dialog.close();};}
function settingsHTML(){return `<section class="settings"><h1>设置与数据同步</h1><p>学习记录先保存在本机，再同步到你的 GitHub 私有仓库。</p><form id="config" class="panel"><h2>☁ 连接 GitHub</h2><p class="hint">连接诊断版 9（实时推送模式）</p><p role="status">${esc(status)}</p><label>GitHub 令牌<input name="token" type="password" required autocomplete="off" value="${esc(config.token||'')}"></label><button type="button" id="load-repos">读取私有仓库</button><p id="repo-message" class="hint" role="status"></p><label id="repo-label" ${config.owner&&config.repo?'':'hidden'}>数据仓库<select name="repository" id="repository">${config.owner&&config.repo?`<option value="${esc(config.owner+'/'+config.repo)}">${esc(config.owner+'/'+config.repo)}</option>`:'<option value="">请先读取仓库</option>'}</select></label><p class="hint">仅授权指定仓库的 Contents 读写权限。Token 仅保存在本设备，不进入同步与备份文件。本机凭据仍有设备访问及网页脚本风险。</p><div class="buttons"><button class="primary">保存并测试连接</button><button type="button" id="clear-token">清除 Token</button></div></form><section class="panel"><h2>💾 备份与恢复</h2><p>定期导出一份学习数据，换设备也安心。</p><div class="buttons"><button id="export">导出 JSON 备份</button><label class="file-button">导入备份<input id="import" type="file" accept="application/json,.json" hidden></label><button id="history">查看完成记录</button></div><p class="hint">恢复会按记录合并，冲突时要求选择版本。备份不包含 Token。</p></section><section class="panel"><h2>🌱 安装到主屏幕</h2><p>iPhone / iPad：在 Safari 分享菜单选择「添加到主屏幕」。电脑：使用浏览器地址栏的安装入口。首次访问并加载成功后即可离线使用。</p></section></section>`;}
function bindSettings(){
 const form=$('#config'),tokenInput=form.elements.token,select=$('#repository'),message=$('#repo-message'),loadButton=$('#load-repos');
 let generation=0;
 const directButton=document.createElement('button');directButton.type='button';directButton.textContent='直接验证 online 仓库';loadButton.after(directButton);
 directButton.onclick=async()=>{
  const token=tokenInput.value.trim(),version=++generation;
  if(!token){message.textContent='请先粘贴令牌。';return;}
  loadButton.disabled=false;message.textContent='正在验证 xfdliujin-netizen/online…';
  try{
   await client({owner:'xfdliujin-netizen',repo:'online',token}).test();
   if(version!==generation||!form.isConnected)return;
   select.innerHTML='<option value="xfdliujin-netizen/online">xfdliujin-netizen/online</option>';
   $('#repo-label').hidden=false;message.textContent='仓库可访问，点击保存并测试连接以开始同步。';
  }catch(e){if(version===generation)message.textContent=e.status===404?'当前令牌无法访问 online（404）。请确认已点击 Update 保存授权，且填写的是这枚令牌。':e.message;}
 };
 tokenInput.oninput=()=>{generation++;select.innerHTML='<option value="">请先读取仓库</option>';$('#repo-label').hidden=true;message.textContent='';loadButton.disabled=false;};
 loadButton.onclick=async()=>{
  const token=tokenInput.value.trim(),version=++generation;
  if(!token){message.textContent='请先粘贴令牌。';return;}
  loadButton.disabled=true;message.textContent='正在读取私有仓库…';
  try{
   const repos=await privateRepositories(token);
   if(version!==generation||!form.isConnected)return;
   select.innerHTML=(repos.length===1?'':'<option value="">请选择数据仓库</option>')+repos.map(r=>'<option value="'+esc(r.owner+'/'+r.repo)+'">'+esc(r.owner+'/'+r.repo)+'</option>').join('');
   $('#repo-label').hidden=!repos.length;
   message.textContent=!repos.length?'未找到可用私有仓库。请先在 GitHub 创建私有仓库，并给令牌授权该仓库的 Contents 读写权限。':repos.length===1?'已自动选中，点击下方保存即可。':'请选择用于存放学习记录的仓库。';
  }catch(e){if(version===generation)message.textContent=e.message;}
  finally{if(version===generation)loadButton.disabled=false;}
 };
 $('#config').onsubmit=async e=>{e.preventDefault();const fields=new FormData(e.target),repository=fields.get('repository');if(!repository)return toast('请先读取并选择私有仓库');const [owner,repo]=repository.split('/'),next={owner,repo,token:fields.get('token').trim()};try{await client(next).test();config=next;await write('config',config);base=await read('base:'+config.owner+'/'+config.repo)||emptyData();setupRealtimePush();toast('连接成功');await sync();}catch(e){message.textContent=e.message;toast(e.message);}};$('#clear-token').onclick=async()=>{config.token='';await write('config',config);status='本地模式';render();toast('本设备 Token 已清除');};$('#export').onclick=()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.href=url;a.download=`study-planner-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};$('#import').onchange=async e=>{try{const incoming=validate(JSON.parse(await e.target.files[0].text()));if(!confirm('将备份合并到当前学习数据，是否继续？'))return;data=merge(emptyData(),data,incoming,choose);await persist();toast('备份已恢复');}catch(e){toast(e.message);}};$('#history').onclick=()=>{const records=Object.values(data.completions).filter(r=>r.status).sort((a,b)=>b.occurrenceDate.localeCompare(a.occurrenceDate));show(`<div class="modal-head"><h2>学习完成记录</h2><button data-close>✕</button></div>${records.map(r=>`<p>${esc(r.occurrenceDate)} · ${esc(data.tasks[r.taskId]?.title||'历史任务')} ✓</p>`).join('')||'<p>完成第一个任务后，记录会出现在这里。</p>'}`);};}
function choose(group,id,l,r){return confirm(`发现冲突：${l.title||l.override?.title||id}\n本机：${JSON.stringify(l)}\n云端/备份：${JSON.stringify(r)}\n\n确定：保留本机版本；取消：保留云端/备份版本。`)?l:r;}
function isEditing(){return screen==='settings'||dialog.open||document.activeElement?.matches('input,textarea,select,[contenteditable="true"]');}
let lastAutoSync=0;

function updateSyncStatus(){
 const button=$('#sync');if(button)button.textContent='☁ '+status;
 const aside=$('.aside-bottom small');if(aside)aside.textContent=status;
}

// ================= 实时推送同步模块 (MQTT over WebSocket) =================
const myDeviceId='dev_'+Math.random().toString(36).slice(2,10);
let mqttClient=null,currentTopic='',pendingRemotePull=false;

function getSyncTopic(){
 const repoPath=(config.owner&&config.repo)?`${config.owner}_${config.repo}`:'xfdliujin-netizen_online';
 return `lyc_study_planner_sync_2026/${repoPath}`;
}

function setupRealtimePush(){
 if(!window.mqtt)return;
 const topic=getSyncTopic();
 if(mqttClient){
  if(currentTopic&&currentTopic!==topic){mqttClient.unsubscribe(currentTopic);mqttClient.subscribe(topic);currentTopic=topic;}
  return;
 }
 currentTopic=topic;
 mqttClient=window.mqtt.connect('wss://broker.emqx.io:8084/mqtt',{keepalive:60,reconnectPeriod:5000});
 mqttClient.on('connect',()=>{if(currentTopic)mqttClient.subscribe(currentTopic);});
 mqttClient.on('message',(t,message)=>{
  if(t!==currentTopic)return;
  try{
   const payload=JSON.parse(message.toString());
   if(payload.sender!==myDeviceId){
    lastAutoSync=0;
    if(isEditing()||busy){pendingRemotePull=true;}
    else{autoSync(true);}
   }
  }catch(e){}
 });
}

function notifyOtherDevices(){
 if(mqttClient&&mqttClient.connected&&currentTopic){
  mqttClient.publish(currentTopic,JSON.stringify({sender:myDeviceId,time:Date.now()}));
 }
}
// =========================================================================

async function autoSync(force=false){
 if(document.hidden||isEditing()||busy||!navigator.onLine||!config.token||storageFailed||(!force&&Date.now()-lastAutoSync<60000))return;
 lastAutoSync=Date.now();await sync({quiet:true});
}
async function sync(options={}){
 const quiet=options.quiet===true;
 if(busy||!config.token||storageFailed)return;
 if(!navigator.onLine){status='等待同步（离线）';if(!quiet&&!isEditing())render();return;}
 busy=true;status='同步中';updateSyncStatus();
 try{
  const api=client(config);let synced=false,pushed=false;
  for(let n=0;n<3;n++){
   const remote=await api.pull();
   if(quiet&&isEditing()){status='编辑中，稍后继续同步';return;}
   const snapshot=structuredClone(data),merged=merge(base,snapshot,remote.data,choose);
   if(JSON.stringify(merged)!==JSON.stringify(remote.data)){
    try{await api.push(merged,remote.sha);pushed=true;}catch(e){if(e.status===409){await new Promise(resolve=>setTimeout(resolve,1000*(n+1)));continue;}throw e;}
   }
   data=merge(snapshot,data,merged,choose);base=merged;
   await write('data',data);await write('base:'+config.owner+'/'+config.repo,base);
   synced=true;break;
  }
  if(!synced)throw Error('多设备正在修改，请稍后重试');
  status='已同步';
  if(pushed)notifyOtherDevices();
 }catch(e){status='同步失败：'+e.message;if(!quiet)toast(e.message);}
 finally{
  busy=false;if(!isEditing())render();
  if(pendingRemotePull&&!isEditing()){pendingRemotePull=false;autoSync(true);}
 }
}
try{await openDB();data=validate(await read('data')||emptyData());config=await read('config')||{};base=await read('base:'+config.owner+'/'+config.repo)||emptyData();render();setupRealtimePush();sync();}catch(e){$('#app').textContent='无法读取本机学习数据。请确认浏览器允许 IndexedDB 存储后重新打开；不要清除已有网站数据。';}
window.addEventListener('online',()=>{lastAutoSync=0;autoSync(true);});
window.addEventListener('offline',()=>{status='等待同步（离线）';if(!isEditing())render();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)autoSync(false);});
dialog.addEventListener('close',()=>{if(pendingRemotePull){pendingRemotePull=false;autoSync(true);}});
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>toast('离线缓存未启用，请检查 HTTPS 或本地服务器。'));