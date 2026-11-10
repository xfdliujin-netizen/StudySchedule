import {homeBoard} from './home-board.js';
import {allTodayDone,fireworks} from './celebration.js';
import {learningView,nearbyDays,relativeDay} from './view-model.js';
import {subjects,today,instances,repeatLabel,shiftDate} from './repeat-engine.js';
import {openDB,read,write,emptyData,validate,defaultKidPerms,defaultPins} from './database.js';
import {saveTask,deleteTask,complete} from './task-manager.js';
import {client,merge,privateRepositories} from './github-sync.js';

const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// 禁止 iOS / iPadOS Safari 捏合缩放整个页面
document.addEventListener('gesturestart',e=>e.preventDefault());
document.addEventListener('gesturechange',e=>e.preventDefault());

// ================= 1. 账号配置与动态密码/权限引擎 =================
const ACCOUNTS = {
  baobao: { username: 'baobao', defaultPin: '1234', name: '刘诣辰', badge: '👶 宝宝账号', role: 'kid' },
  baba:   { username: 'baba',   defaultPin: '8888', name: '爸爸',   badge: '👨 父母管理', role: 'parent' },
  mama:   { username: 'mama',   defaultPin: '8888', name: '妈妈',   badge: '👩 父母管理', role: 'parent' }
};

let data=emptyData(),base=emptyData(),config={},subject='all',filter='all',date=today(),busy=false,status='本地模式',timer,screen='tasks',storageFailed=false,reportRange='week',logFilter='all';
let currentUser = null;

// 获取某个账号当前的有效密码（优先读取设置里修改后的密码）
function getAccountPin(username) {
  const custom = data?.pins?.[username];
  if (custom && String(custom).trim()) return String(custom).trim();
  return ACCOUNTS[username]?.defaultPin || '';
}

// 校验本地保存的登录状态是否依然有效（如果父母在其他设备改了密码，自动退出要求重登）
function verifySavedSession() {
  try {
    const saved = JSON.parse(localStorage.getItem('lyc_study_auth_user') || 'null');
    if (saved && ACCOUNTS[saved.username] && getAccountPin(saved.username) === saved.pin) {
      currentUser = ACCOUNTS[saved.username];
    } else {
      currentUser = null;
    }
  } catch (e) {
    currentUser = null;
  }
}

const isParent = () => currentUser?.role === 'parent';
const canAddTask = () => isParent() || Boolean(data.kidPerms?.canAdd);
const canEditTask = () => isParent() || Boolean(data.kidPerms?.canEdit);
const canDeleteTask = () => isParent() || Boolean(data.kidPerms?.canDelete);
const canViewReports = () => isParent() || Boolean(data.kidPerms?.canReport);

function recordLog(action, taskTitle, subjectId, detail = '') {
  if (!data.logs) data.logs = {};
  const id = 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const subObj = subjects.find(s => s.id === subjectId);
  data.logs[id] = {
    id,
    action, // 'add' | 'edit' | 'delete'
    taskTitle: taskTitle || '未命名任务',
    subjectName: subObj ? subObj.name : '系统安全',
    detail,
    user: currentUser ? currentUser.name : '未知用户',
    badge: currentUser ? currentUser.badge : '',
    timestamp: Date.now()
  };
}
// ===============================================================

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

// ================= 2. 登录界面渲染与事件 =================
function loginHTML() {
  return `<div class="login-screen">
    <form id="login-form" class="login-card">
      <div class="login-brand"><span>✦</span></div>
      <h1>小小学习家</h1>
      <p class="login-subtitle">请选择登录身份并输入密码</p>
      <div class="role-selector">
        <button type="button" class="role-chip" data-user="baobao">👶 宝宝 (刘诣辰)</button>
        <button type="button" class="role-chip" data-user="baba">👨 爸爸</button>
        <button type="button" class="role-chip" data-user="mama">👩 妈妈</button>
      </div>
      <label>登录账号
        <input name="username" id="login-user" required autocomplete="username" placeholder="baobao / baba / mama" value="baobao">
      </label>
      <label>登录密码
        <input name="pin" id="login-pin" type="password" required autocomplete="current-password" placeholder="请输入密码">
      </label>
      <p id="login-error" class="login-error" role="alert"></p>
      <button type="submit" class="primary full login-submit">进入学习空间</button>
    </form>
  </div>`;
}

function bindLogin() {
  const userInp = $('#login-user'), pinInp = $('#login-pin'), err = $('#login-error');
  document.querySelectorAll('.role-chip').forEach(btn => {
    if (btn.dataset.user === userInp.value) btn.classList.add('selected');
    btn.onclick = () => {
      document.querySelectorAll('.role-chip').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      userInp.value = btn.dataset.user;
      err.textContent = '';
      pinInp.focus();
    };
  });
  $('#login-form').onsubmit = e => {
    e.preventDefault();
    const u = userInp.value.trim().toLowerCase(), p = pinInp.value.trim();
    const acc = ACCOUNTS[u];
    if (!acc || getAccountPin(u) !== p) {
      err.textContent = '账号或密码不正确，请重试';
      return;
    }
    currentUser = acc;
    localStorage.setItem('lyc_study_auth_user', JSON.stringify({ username: acc.username, pin: p }));
    if (!isParent() && screen === 'settings') screen = 'tasks';
    if (!canViewReports() && screen === 'reports') screen = 'tasks';
    toast(`欢迎回来，${acc.name}！`);
    render();
  };
}

function logout() {
  if (!confirm(`当前登录：${currentUser.name}\n确定要退出并切换账号吗？`)) return;
  currentUser = null;
  localStorage.removeItem('lyc_study_auth_user');
  render();
}

// ================= 3. 后台看板：权限控制 + 周报月报 + 增删审计日志 =================
function computeStats(daysCount) {
  const end = today();
  const dates = [];
  for (let i = daysCount - 1; i >= 0; i--) dates.push(shiftDate(end, -i));
  let total = 0, done = 0, activeDays = 0;
  const bySub = {
    chinese: { name: '语文', icon: '文', total: 0, done: 0 },
    math:    { name: '数学', icon: 'π',  total: 0, done: 0 },
    english: { name: '英语', icon: 'Aa', total: 0, done: 0 }
  };
  const daily = [];
  for (const d of dates) {
    const items = instances(data, d);
    const dTotal = items.length;
    const dDone = items.filter(x => x.done).length;
    total += dTotal;
    done += dDone;
    if (dDone > 0) activeDays++;
    for (const item of items) {
      if (bySub[item.subjectId]) {
        bySub[item.subjectId].total++;
        if (item.done) bySub[item.subjectId].done++;
      }
    }
    daily.push({ date: d, label: `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`, total: dTotal, done: dDone, rate: dTotal ? Math.round(dDone / dTotal * 100) : 0 });
  }
  const rate = total ? Math.round(done / total * 100) : 0;
  return { daysCount, startDate: dates[0], endDate: end, total, done, pending: total - done, rate, activeDays, bySub, daily };
}

function reportsHTML() {
  const days = reportRange === 'week' ? 7 : 30;
  const st = computeStats(days);
  const chartDays = reportRange === 'week' ? st.daily : st.daily.slice(-14);
  const perms = data.kidPerms || defaultKidPerms();
  const allLogs = Object.values(data.logs || {}).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  const filteredLogs = allLogs.filter(l => logFilter === 'all' || l.action === logFilter);

  const actionLabels = {
    add:    { text: '添加任务', cls: 'log-add',  icon: '➕' },
    edit:   { text: '编辑修改', cls: 'log-edit', icon: '✏️' },
    delete: { text: '删除任务', cls: 'log-del',  icon: '🗑️' }
  };

  return `<section class="reports-view">
    <div class="reports-header">
      <div>
        <span class="hero-pill">📊 ${isParent() ? '父母管理后台 · 统计与权限中心' : '学习统计报告'}</span>
        <h1>学习${reportRange === 'week' ? '周报' : '月报'}与管理看板</h1>
        <p class="hero-sub">统计周期：${st.startDate} 至 ${st.endDate}（共 ${days} 天）</p>
      </div>
      <div class="range-switch">
        <button type="button" data-range="week" class="${reportRange === 'week' ? 'selected' : ''}">近 7 天周报</button>
        <button type="button" data-range="month" class="${reportRange === 'month' ? 'selected' : ''}">近 30 天月报</button>
      </div>
    </div>

    ${isParent() ? `<section class="panel perm-panel">
      <div class="perm-header">
        <div>
          <h2>🛡️ 宝宝账号（刘诣辰）权限动态控制</h2>
          <p>爸爸妈妈可随时开启或关闭孩子的对应操作权限，修改后自动同步至所有设备（设置与同步页面始终仅限父母访问）。</p>
        </div>
        ${perms.updatedAt ? `<small class="perm-meta">最近由 ${esc(perms.updatedBy)} 修改于 ${esc(new Date(perms.updatedAt).toLocaleString('zh-CN'))}</small>` : ''}
      </div>
      <div class="perm-grid">
        <label class="perm-switch-card">
          <div><strong>➕ 允许添加新任务</strong><small>开启后宝宝可自己新增学习计划</small></div>
          <input type="checkbox" data-perm="canAdd" ${perms.canAdd ? 'checked' : ''}>
        </label>
        <label class="perm-switch-card">
          <div><strong>✏️ 允许编辑修改任务</strong><small>开启后宝宝可修改任务内容与暂停计划</small></div>
          <input type="checkbox" data-perm="canEdit" ${perms.canEdit ? 'checked' : ''}>
        </label>
        <label class="perm-switch-card">
          <div><strong>🗑️ 允许删除任务</strong><small>开启后宝宝卡片上会显示删除按钮</small></div>
          <input type="checkbox" data-perm="canDelete" ${perms.canDelete ? 'checked' : ''}>
        </label>
        <label class="perm-switch-card">
          <div><strong>📊 允许查看统计报告</strong><small>开启后宝宝也能查看周报月报看板</small></div>
          <input type="checkbox" data-perm="canReport" ${perms.canReport ? 'checked' : ''}>
        </label>
      </div>
    </section>` : ''}

    <div class="report-kpis">
      <div class="kpi-card kpi-blue"><span>总完成率</span><strong>${st.rate}<small>%</small></strong><em>周期内综合达成度</em></div>
      <div class="kpi-card kpi-green"><span>已完成任务</span><strong>${st.done}<small> 项</small></strong><em>累计打卡完成</em></div>
      <div class="kpi-card kpi-warm"><span>未完成 / 待办</span><strong>${st.pending}<small> 项</small></strong><em>周期内剩余任务</em></div>
      <div class="kpi-card kpi-purple"><span>活跃打卡天数</span><strong>${st.activeDays}<small> / ${days}天</small></strong><em>有完成记录的日期</em></div>
    </div>

    <div class="report-grid">
      <section class="panel report-panel">
        <h2>📚 各学科完成情况对比</h2>
        <div class="sub-bars">
          ${Object.entries(st.bySub).map(([id, s]) => {
            const p = s.total ? Math.round(s.done / s.total * 100) : 0;
            return `<div class="sub-bar-row">
              <div class="sub-bar-head">
                <span class="nav-icon icon-${id}">${s.icon}</span>
                <div class="sub-bar-title"><strong>${s.name}</strong><small>已完成 ${s.done} / 共 ${s.total} 项计划</small></div>
                <b class="sub-bar-pct">${p}%</b>
              </div>
              <div class="track"><i class="bar-${id}" style="width:${p}%"></i></div>
            </div>`;
          }).join('')}
        </div>
      </section>

      <section class="panel report-panel">
        <h2>📈 每日打卡趋势（${reportRange === 'week' ? '近 7 天' : '最近 14 天'}）</h2>
        <div class="daily-chart">
          ${chartDays.map(d => `<div class="chart-col">
            <div class="chart-bar-wrap" title="${d.date}: 完成 ${d.done}/${d.total} 项 (${d.rate}%)">
              <div class="chart-bar" style="height:${Math.max(d.total ? 8 : 2, d.rate)}%"></div>
            </div>
            <strong>${d.done}/${d.total}</strong>
            <small>${d.label}</small>
          </div>`).join('')}
        </div>
      </section>
    </div>

    <section class="panel audit-panel">
      <div class="audit-head">
        <div>
          <h2>📋 任务增删改操作记录</h2>
          <p>实时记录每一次添加、修改和删除任务的责任人与精确时间（共 ${allLogs.length} 条记录）。</p>
        </div>
        <div class="range-switch">
          ${[['all','全部'],['add','➕ 添加'],['edit','✏️ 修改'],['delete','🗑️ 删除']].map(([k,n])=>`<button type="button" data-log-filter="${k}" class="${logFilter===k?'selected':''}">${n}</button>`).join('')}
        </div>
      </div>
      <div class="audit-list">
        ${filteredLogs.slice(0, 60).map(item => {
          const info = actionLabels[item.action] || { text: '操作', cls: 'log-edit', icon: '📌' };
          return `<div class="audit-row">
            <span class="audit-tag ${info.cls}">${info.icon} ${info.text}</span>
            <div class="audit-main">
              <strong>【${esc(item.subjectName)}】${esc(item.taskTitle)}</strong>
              ${item.detail ? `<small>${esc(item.detail)}</small>` : ''}
            </div>
            <div class="audit-meta">
              <span class="audit-user">操作人：<b>${esc(item.user)}</b></span>
              <time>${esc(new Date(item.timestamp).toLocaleString('zh-CN'))}</time>
            </div>
          </div>`;
        }).join('') || `<div class="empty"><p>暂无符合筛选条件的增删改操作记录</p></div>`}
      </div>
    </section>
  </section>`;
}

// ================= 4. 主界面渲染（含动态权限控制） =================
function render(){
 verifySavedSession();
 if (!currentUser) {
  $('#app').className = 'theme-all';
  $('#app').innerHTML = loginHTML();
  bindLogin();
  return;
 }
 const parentMode = isParent();
 const allowAdd = canAddTask(), allowEdit = canEditTask(), allowDel = canDeleteTask(), allowRep = canViewReports();

 if (!parentMode && screen === 'settings') screen = 'tasks';
 if (!allowRep && screen === 'reports') screen = 'tasks';

 const theme=themes[subject],view=learningView(data,subject,date),rows=view.rows;
 const day=relativeDay(date),home=subject==='all';
 $('#app').className=`theme-${screen==='settings'||screen==='reports'?'all':subject} role-${currentUser.role}`;

 const userBadgeHTML = `<button type="button" class="user-badge-pill" data-logout title="点击切换登录账号">
   <span class="user-dot"></span>
   <span>${esc(currentUser.name)}</span>
   <small>切换</small>
 </button>`;
 const mobileUserSwitchHTML = `<button type="button" class="mobile-user-switch" data-logout title="点击切换登录账号"><span class="user-dot"></span>${esc(currentUser.name)}<small>切换</small></button>`;

 $('#app').innerHTML=`<aside>
   <a class="brand" href="#"><span>✦</span><div>小小学习家</div></a>
   <div class="nav-caption">学习空间</div>
   <nav aria-label="学习导航">
     ${Object.entries(themes).map(([id,s])=>{const n=id==='all'?0:learningView(data,id,date).pending;return `<button data-sub="${id}" class="${subject===id&&screen==='tasks'?'active':''}"><span class="nav-icon icon-${id}">${s.icon}</span><span>${s.name}</span>${n?`<b>${n}</b>`:''}</button>`;}).join('')}
     ${allowRep?`<button id="nav-reports" class="${screen==='reports'?'active':''}"><span class="nav-icon icon-all">📊</span><span>周报与管理</span></button>`:''}
   </nav>
   <div class="aside-bottom">
     <div class="sidebar-user-box">
       <div><strong>${esc(currentUser.badge)}</strong><small>当前登录：${esc(currentUser.name)}</small></div>
       <button type="button" class="switch-user-btn" data-logout>切换</button>
     </div>
     ${parentMode?`<button id="settings">⚙ 设置与同步</button>`:''}
     <small>${esc(status)}</small>
   </div>
 </aside>
 <main>
   <header>
     <span>${screen==='settings'?'设置':screen==='reports'?'统计与管理后台':home?'首页':'学科计划 / '+theme.name}</span>
     <div class="header-right">
       ${userBadgeHTML}
       ${allowRep?`<button id="header-reports" class="${screen==='reports'?'active':''}">📊 后台看板</button>`:''}
       ${parentMode?`<button id="mobile-settings" aria-label="设置">⚙</button>`:''}
       <button id="sync">☁ ${esc(status)}</button>
     </div>
   </header>
   ${ipadRailHTML(allowRep,parentMode)}
   ${screen==='settings'?settingsHTML():screen==='reports'?reportsHTML():`<div class="ipad-shell"><div class="ipad-center">${home?`<section class="hero-banner hero-home"><div class="hero-content"><div class="hero-badges"><span class="hero-pill">✦ 今日闪闪发光</span></div><h1>刘诣辰的学习计划</h1><p class="hero-sub">专属学习空间 · 每一步都算数</p></div><div class="hero-visual" aria-hidden="true">${themes.all.art}</div></section>`:`<section class="hero-banner hero-${subject}"><div class="hero-content"><div class="hero-badges"><span class="hero-pill">0${['chinese','math','english'].indexOf(subject)+1} · ${theme.tag}</span></div><h1>${theme.name}<span>学习计划</span></h1><p class="hero-sub">${theme.subtitle}</p></div><div class="hero-visual" aria-hidden="true">${theme.art}</div></section>`}
   <section class="day-planner" aria-label="日期计划"><div class="planner-heading"><h2>${home?'这几天的安排':'学习日历'}</h2><label class="date">选择日期 <input type="date" id="date" value="${date}" aria-label="查看日期"></label></div><div class="day-tabs">${nearbyDays(data).map(d=>{return `<button data-date="${d.date}" class="${d.date===date?'selected':''}" aria-pressed="${d.date===date}"><span>${d.label}</span><small>${Number(d.date.slice(5,7))}/${Number(d.date.slice(8))}</small></button>`;}).join('')}</div></section>
   <section class="stats" aria-label="${home?'全部科目':theme.name}统计"><button class="stat warm" data-filter="pending"><span>待学习</span><strong>${view.pending}<small> 项</small></strong></button><button class="stat green" data-filter="done"><span>${esc(day)}已学习</span><strong>${view.done}<small> 项</small></strong></button><div class="stat progress"><span>${esc(day)}进度 <b>${view.percent}%</b></span><div class="track"><i style="width:${view.percent}%"></i></div><small>${view.done} / ${view.total} 项完成</small></div></section>
   </div><div class="ipad-right">${home?homeBoard(data,date):`<section class="workspace subject-workspace"><div class="section-head"><div><h2>${esc(day)}${theme.name}任务</h2><p>${view.total} 项当日计划${date===today()?' · 含往期待办':''}</p></div>${allowAdd?`<button class="primary" id="add">＋ 添加任务</button>`:''}</div><div class="toolbar"><div class="filters">${[['all','全部'],['pending','待学习'],['done','已学习']].map(([id,name])=>`<button data-filter="${id}" class="${filter===id?'selected':''}">${name}</button>`).join('')}</div></div><div class="cards">${rows.filter(t=>filter==='all'||(filter==='done'?t.done:!t.done)).map(cardHTML).join('')||`<div class="empty"><span class="empty-symbol">${theme.icon}</span><h3>${filter==='done'?'暂无已完成任务':'暂无'+theme.name+'任务'}</h3><p>${filter==='done'?'完成任务后会显示在这里':allowAdd?'点击添加任务，安排'+esc(day)+'的学习':'今天还没有安排这项学习任务哦'}</p></div>`}</div>${allowEdit?pausedHTML():''}</section>`}</div></div>`}
 </main>
 ${mobileUserSwitchHTML}
 <nav class="mobile-nav" aria-label="底部导航">
   ${Object.entries(themes).map(([id,s])=>`<button data-sub="${id}" class="${subject===id&&screen==='tasks'?'active':''}"><span class="nav-icon icon-${id}">${s.icon}</span><small>${s.name}</small></button>`).join('')}
   ${allowRep?`<button id="mobile-reports" class="${screen==='reports'?'active':''}"><span class="nav-icon">📊</span><small>看板</small></button>`:''}
 </nav>`;

 if (!parentMode && $('#board-settings')) $('#board-settings').remove();

 document.querySelectorAll('[data-logout]').forEach(b => b.onclick = logout);
 document.querySelectorAll('[data-sub]').forEach(b=>b.onclick=()=>{subject=b.dataset.sub;screen='tasks';filter='all';render();});
 document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;screen='tasks';render();});
 document.querySelectorAll('[data-date]').forEach(b=>b.onclick=()=>{date=b.dataset.date;filter='all';render();});
 document.querySelectorAll('.mobile-nav [data-sub]').forEach(b=>{const id=b.dataset.sub;if(id!=='all'){const n=learningView(data,id,date).pending;if(n){const badge=document.createElement('b');badge.className='mobile-badge';badge.textContent=n;b.append(badge);}}});

 const openSettings=()=>{if(!isParent())return;screen='settings';render();};
 const openReports=()=>{if(!canViewReports())return;screen='reports';render();};
 if($('#settings'))$('#settings').onclick=openSettings;
 if($('#mobile-settings'))$('#mobile-settings').onclick=openSettings;
 if($('#board-settings')&&parentMode)$('#board-settings').onclick=openSettings;
 if($('#nav-reports'))$('#nav-reports').onclick=openReports;
 if($('#header-reports'))$('#header-reports').onclick=openReports;
 if($('#mobile-reports'))$('#mobile-reports').onclick=openReports;
 if($('#sync'))$('#sync').onclick=sync;

 // iPad 三栏：左侧 Tab 栏 + 抽拉抽屉
 const drawerEl=$('#ipad-drawer'),maskEl=$('#drawer-mask');
 const setDrawer=open=>{if(!drawerEl)return;drawerEl.classList.toggle('open',open);if(maskEl)maskEl.classList.toggle('show',open);};
 if($('#rail-menu')&&drawerEl)$('#rail-menu').onclick=()=>setDrawer(!drawerEl.classList.contains('open'));
 if($('#drawer-close'))$('#drawer-close').onclick=()=>setDrawer(false);
 if(maskEl)maskEl.onclick=()=>setDrawer(false);
 if($('#rail-reports'))$('#rail-reports').onclick=openReports;
 if($('#drawer-reports'))$('#drawer-reports').onclick=openReports;
 if($('#rail-settings'))$('#rail-settings').onclick=openSettings;
 if($('#drawer-settings'))$('#drawer-settings').onclick=openSettings;

 if(screen==='settings')bindSettings();
 else if(screen==='reports'){
  document.querySelectorAll('[data-range]').forEach(b=>b.onclick=()=>{reportRange=b.dataset.range;render();});
  document.querySelectorAll('[data-log-filter]').forEach(b=>b.onclick=()=>{logFilter=b.dataset.logFilter;render();});
  document.querySelectorAll('[data-perm]').forEach(chk=>{
   chk.onchange=async e=>{
    if(!isParent())return;
    const key=e.target.dataset.perm;
    if(!data.kidPerms)data.kidPerms=defaultKidPerms();
    data.kidPerms[key]=e.target.checked;
    data.kidPerms.updatedAt=Date.now();
    data.kidPerms.updatedBy=currentUser.name;
    toast(`已${e.target.checked?'开启':'关闭'}宝宝对应权限`);
    await persist();
   };
  });
 }else{
  if($('#add')&&allowAdd)$('#add').onclick=()=>edit();
  if($('#date'))$('#date').onchange=e=>{if(e.target.value){date=e.target.value;filter='all';render();}};
  document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{
   const t=rows.find(t=>t.key===b.dataset.key);
   if(b.dataset.action==='complete'){
    const wasDone=allTodayDone(data);complete(data,t);
    persist().then(()=>{if(!storageFailed&&!wasDone&&t.date===today()&&allTodayDone(data))fireworks();else if(!t.done)toast('完成了！🌟');});
   }
   if(allowEdit && b.dataset.action==='edit')edit(t);
   if(allowDel && b.dataset.action==='delete')remove(t);
  });
  if(allowEdit){
   document.querySelectorAll('[data-resume]').forEach(b=>b.onclick=()=>edit({...data.tasks[b.dataset.resume],date}));
  }
 }
}

function ipadRailHTML(allowRep,parentMode){
 const items=Object.entries(themes).map(([id,s])=>({id,name:s.name,icon:s.icon,count:id==='all'?0:learningView(data,id,date).pending,active:subject===id&&screen==='tasks'}));
 const rail=items.map(it=>`<button type="button" data-sub="${it.id}" class="${it.active?'active':''}" aria-label="${it.name}"><span class="nav-icon icon-${it.id}">${it.icon}</span><small>${it.name}</small>${it.count?`<i>${it.count}</i>`:''}</button>`).join('');
 const drawerNav=items.map(it=>`<button type="button" data-sub="${it.id}" class="${it.active?'active':''}"><span class="nav-icon icon-${it.id}">${it.icon}</span><span>${it.name}</span>${it.count?`<b>${it.count}</b>`:''}</button>`).join('');
 return `<div class="ipad-rail" role="navigation" aria-label="学习导航栏">
   <button type="button" class="rail-menu" id="rail-menu" aria-label="展开导航">☰</button>
   ${rail}
   ${allowRep?`<button type="button" class="${screen==='reports'?'active':''}" id="rail-reports" aria-label="看板"><span class="nav-icon">📊</span><small>看板</small></button>`:''}
   ${parentMode?`<button type="button" class="${screen==='settings'?'active':''}" id="rail-settings" aria-label="设置"><span class="nav-icon">⚙</span><small>设置</small></button>`:''}
   <button type="button" class="rail-avatar" data-logout title="切换账号">${esc(currentUser.name.slice(0,1))}</button>
  </div>
  <div class="ipad-drawer" id="ipad-drawer" role="navigation" aria-label="导航抽屉">
   <div class="drawer-head"><a class="brand" href="#"><span>✦</span><div>小小学习家</div></a><button type="button" id="drawer-close" aria-label="收起">✕</button></div>
   <div class="drawer-caption">学习空间</div>
   <nav>${drawerNav}${allowRep?`<button type="button" id="drawer-reports" class="${screen==='reports'?'active':''}"><span class="nav-icon">📊</span><span>周报与管理</span></button>`:''}</nav>
   <div class="drawer-foot">
    <div class="drawer-user"><strong>${esc(currentUser.badge)}</strong><small>当前登录：${esc(currentUser.name)}</small></div>
    ${parentMode?`<button type="button" id="drawer-settings">⚙ 设置与同步</button>`:''}
    <small>${esc(status)}</small>
   </div>
  </div>
  <div class="ipad-drawer-mask" id="drawer-mask"></div>`;
}

function cardHTML(t){
 const allowEdit = canEditTask(), allowDel = canDeleteTask();
 return `<article class="task ${t.done?'completed':''}"><button class="check" data-action="complete" data-key="${esc(t.key)}" aria-label="${t.done?'撤销完成':'完成任务'}">${t.done?'✓':''}</button><div class="task-body">${(allowEdit||allowDel)?`<div class="task-actions">${allowEdit?`<button data-action="edit" data-key="${esc(t.key)}" aria-label="编辑任务">编辑</button>`:''}${allowDel?`<button data-action="delete" data-key="${esc(t.key)}" aria-label="删除任务">删除</button>`:''}</div>`:''}<h3>${esc(t.title)}</h3>${t.description?`<p>${esc(t.description)}</p>`:''}<div class="meta"><span>📅 ${t.date}</span><span>↻ ${esc(repeatLabel(t.repeatRule))}</span></div>${t.done?`<small>完成于 ${esc(new Date(t.completedAt).toLocaleString('zh-CN'))}</small>`:''}</div></article>`;
}

function pausedHTML(){const tasks=Object.values(data.tasks).filter(t=>!t.deleted&&(!t.enabled||t.startDate>date)&&(subject==='all'||t.subjectId===subject));return tasks.length?`<details class="plans"><summary>暂停 / 未来计划（${tasks.length}）</summary>${tasks.map(t=>`<p>${esc(t.title)} · ${t.enabled?t.startDate+' 开始':'已暂停'} <button data-resume="${esc(t.id)}">管理计划</button></p>`).join('')}</details>`:'';}
function show(content){dialog.innerHTML=content;dialog.showModal();dialog.querySelector('[data-close]')?.addEventListener('click',()=>dialog.close());}

function edit(t){
 if(t ? !canEditTask() : !canAddTask()) return;
 const initial=t||{subjectId:subject==='all'?'chinese':subject,title:'',description:'',startDate:date,endDate:'',durationMinutes:20,reminderTime:'',enabled:true,repeatRule:{type:'daily',days:[1,3,5],interval:2}};
 show(`<form id="task-form"><div class="modal-head"><h2>${t?'编辑学习计划':'添加学习任务'}</h2><button type="button" data-close aria-label="关闭">✕</button></div><label>任务名称<input name="title" required maxlength="100" value="${esc(initial.title)}" placeholder="例如：课外阅读 20 分钟"></label><div class="form-row"><label>科目<select name="subjectId">${subjects.map(s=>`<option value="${s.id}" ${s.id===initial.subjectId?'selected':''}>${s.name}</option>`).join('')}</select></label></div><label>学习内容<textarea name="description" maxlength="2000" rows="3" placeholder="今天准备学习什么？">${esc(initial.description)}</textarea></label><div class="form-row"><label>重复方式<select id="repeat" name="repeat">${[['once','仅一次'],['daily','每天'],['weekly','每周（自定义）'],['interval','每隔 N 天']].map(([v,n])=>`<option value="${v}" ${v===initial.repeatRule.type?'selected':''}>${n}</option>`).join('')}</select></label></div><div id="weekly" class="weekdays">${[0,1,2,3,4,5,6].map(d=>`<label><input type="checkbox" name="days" value="${d}" ${initial.repeatRule.days?.includes(d)?'checked':''}><span>${'日一二三四五六'[d]}</span></label>`).join('')}</div><label id="interval">间隔天数<input name="interval" type="number" min="1" max="3650" value="${initial.repeatRule.interval||2}"></label><label class="inline"><input name="enabled" type="checkbox" ${initial.enabled?'checked':''}> 启用此计划</label>${t?'<label>修改范围<select name="scope"><option value="day">仅修改此执行日</option><option value="future">此执行日及以后的计划</option></select></label>':''}<button class="primary full">保存学习计划</button></form>`);
 const update=()=>{$('#weekly').hidden=$('#repeat').value!=='weekly';$('#interval').hidden=$('#repeat').value!=='interval';};
 $('#repeat').onchange=update;update();
 $('#task-form').onsubmit=async e=>{
  e.preventDefault();
  const f=new FormData(e.target),rule={type:f.get('repeat'),days:f.getAll('days').map(Number),interval:Number(f.get('interval'))};
  if(rule.type==='weekly'&&!rule.days.length)return toast('请至少选择一个星期');
  if(rule.type==='interval'&&(!Number.isInteger(rule.interval)||rule.interval<1))return toast('请输入有效的间隔天数');
  const title=f.get('title').trim(),subId=f.get('subjectId'),scope=f.get('scope');
  saveTask(data,{title,description:f.get('description'),subjectId:subId,startDate:initial.startDate,endDate:initial.endDate||'',reminderTime:initial.reminderTime||'',durationMinutes:initial.durationMinutes||20,repeatRule:rule,enabled:f.has('enabled')},t,t?.date,scope);
  recordLog(t ? 'edit' : 'add', title, subId, t ? (scope === 'day' ? `仅修改 ${t.date} 当日` : `修改 ${t.date} 及后续计划`) : `起始日期：${initial.startDate}`);
  await persist();dialog.close();
 };
}

function remove(t){
 if(!canDeleteTask())return;
 show(`<form id="delete-form"><div class="modal-head"><h2>删除学习任务</h2><button type="button" data-close>✕</button></div><p>确定删除「${esc(t.title)}」？历史完成记录会保留。</p><label>删除范围<select name="scope"><option value="day">仅删除此执行日</option><option value="future">终止此执行日及后续计划</option><option value="series">删除整个任务系列</option></select></label><button class="danger full">确认删除</button></form>`);
 $('#delete-form').onsubmit=async e=>{
  e.preventDefault();
  const scope=new FormData(e.target).get('scope');
  const scopeLabels={day:`仅删除 ${t.date} 当日`,future:`终止 ${t.date} 及后续计划`,series:'删除整个任务系列'};
  deleteTask(data,t.id,t.date,scope);
  recordLog('delete', t.title, t.subjectId, scopeLabels[scope] || '');
  await persist();dialog.close();
 };
}

function settingsHTML(){
 const pins = data.pins || defaultPins();
 return `<section class="settings">
  <h1>设置与数据同步</h1>
  <p>学习记录先保存在本机，再同步到你的 GitHub 私有仓库。</p>

  <form id="pin-form" class="panel">
   <div class="pin-panel-head">
    <div>
     <h2>🔑 账号与登录密码管理</h2>
     <p class="hint">无需修改代码，在此直接设置各角色登录密码，保存后将自动同步至所有设备。</p>
    </div>
    <button type="button" id="toggle-pin-view" class="pin-eye-btn">👁 显示密码</button>
   </div>
   ${pins.updatedAt ? `<p class="perm-meta" style="display:inline-block;margin:0 0 10px">最近由 ${esc(pins.updatedBy)} 修改于 ${esc(new Date(pins.updatedAt).toLocaleString('zh-CN'))}</p>` : ''}
   <div class="pin-grid">
    <label class="pin-card">
     <span>👶 宝宝密码（账号：<b>baobao</b>）</span>
     <input name="pin_baobao" class="pin-input" type="password" required maxlength="32" value="${esc(getAccountPin('baobao'))}" placeholder="设置宝宝密码">
    </label>
    <label class="pin-card">
     <span>👨 爸爸密码（账号：<b>baba</b>）</span>
     <input name="pin_baba" class="pin-input" type="password" required maxlength="32" value="${esc(getAccountPin('baba'))}" placeholder="设置爸爸密码">
    </label>
    <label class="pin-card">
     <span>👩 妈妈密码（账号：<b>mama</b>）</span>
     <input name="pin_mama" class="pin-input" type="password" required maxlength="32" value="${esc(getAccountPin('mama'))}" placeholder="设置妈妈密码">
    </label>
   </div>
   <div class="buttons" style="margin-top:14px">
    <button type="submit" class="primary">保存并同步新密码</button>
   </div>
  </form>

  <form id="config" class="panel"><h2>☁ 连接 GitHub</h2><p class="hint">连接诊断版 12（支持在线改密 + 动态权限 + 审计日志）</p><p role="status">${esc(status)}</p><label>GitHub 令牌<input name="token" type="password" required autocomplete="off" value="${esc(config.token||'')}"></label><button type="button" id="load-repos">读取私有仓库</button><p id="repo-message" class="hint" role="status"></p><label id="repo-label" ${config.owner&&config.repo?'':'hidden'}>数据仓库<select name="repository" id="repository">${config.owner&&config.repo?`<option value="${esc(config.owner+'/'+config.repo)}">${esc(config.owner+'/'+config.repo)}</option>`:'<option value="">请先读取仓库</option>'}</select></label><p class="hint">仅授权指定仓库的 Contents 读写权限。Token 仅保存在本设备，不进入同步与备份文件。本机凭据仍有设备访问及网页脚本风险。</p><div class="buttons"><button class="primary">保存并测试连接</button><button type="button" id="clear-token">清除 Token</button></div></form>
  <section class="panel"><h2>💾 备份与恢复</h2><p>定期导出一份学习数据，换设备也安心。</p><div class="buttons"><button id="export">导出 JSON 备份</button><label class="file-button">导入备份<input id="import" type="file" accept="application/json,.json" hidden></label><button id="history">查看完成记录</button></div><p class="hint">恢复会按记录合并，冲突时要求选择版本。备份不包含 Token。</p></section>
  <section class="panel"><h2>🌱 安装到主屏幕</h2><p>iPhone / iPad：在 Safari 分享菜单选择「添加到主屏幕」。电脑：使用浏览器地址栏的安装入口。首次访问并加载成功后即可离线使用。</p></section>
 </section>`;
}

function bindSettings(){
 // 绑定密码显示/隐藏切换与保存事件
 const pinForm = $('#pin-form'), toggleBtn = $('#toggle-pin-view');
 if (toggleBtn && pinForm) {
  let showPlain = false;
  toggleBtn.onclick = () => {
   showPlain = !showPlain;
   pinForm.querySelectorAll('.pin-input').forEach(inp => inp.type = showPlain ? 'text' : 'password');
   toggleBtn.textContent = showPlain ? '🙈 隐藏密码' : '👁 显示密码';
  };
  pinForm.onsubmit = async e => {
   e.preventDefault();
   const f = new FormData(pinForm);
   const pBaobao = String(f.get('pin_baobao') || '').trim();
   const pBaba   = String(f.get('pin_baba') || '').trim();
   const pMama   = String(f.get('pin_mama') || '').trim();
   if (!pBaobao || !pBaba || !pMama) return toast('密码不能为空');

   const changed = [];
   if (pBaobao !== getAccountPin('baobao')) changed.push('宝宝');
   if (pBaba !== getAccountPin('baba')) changed.push('爸爸');
   if (pMama !== getAccountPin('mama')) changed.push('妈妈');
   if (!changed.length) return toast('密码未发生变化');

   data.pins = {
    baobao: pBaobao,
    baba: pBaba,
    mama: pMama,
    updatedAt: Date.now(),
    updatedBy: currentUser.name
   };
   // 更新当前设备已保存的登录凭证，避免改完自己的密码后本机被踢出
   if (currentUser) {
    localStorage.setItem('lyc_study_auth_user', JSON.stringify({
     username: currentUser.username,
     pin: data.pins[currentUser.username]
    }));
   }
   recordLog('edit', `修改了【${changed.join('、')}】的登录密码`, 'all', '安全设置变更');
   toast('新密码已保存，正在同步至所有设备…');
   await persist();
  };
 }

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
function isEditing(){return !currentUser||screen==='settings'||dialog.open||document.activeElement?.matches('input,textarea,select,[contenteditable="true"]');}
let lastAutoSync=0;

function updateSyncStatus(){
 const button=$('#sync');if(button)button.textContent='☁ '+status;
 const aside=$('.aside-bottom>small');if(aside)aside.textContent=status;
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
try{await openDB();data=validate(await read('data')||emptyData());config=await read('config')||{};base=await read('base:'+config.owner+'/'+config.repo)||emptyData();verifySavedSession();render();setupRealtimePush();sync();}catch(e){$('#app').textContent='无法读取本机学习数据。请确认浏览器允许 IndexedDB 存储后重新打开；不要清除已有网站数据。';}
window.addEventListener('online',()=>{lastAutoSync=0;autoSync(true);});
window.addEventListener('offline',()=>{status='等待同步（离线）';if(!isEditing())render();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)autoSync(false);});
dialog.addEventListener('close',()=>{if(pendingRemotePull){pendingRemotePull=false;autoSync(true);}});
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>toast('离线缓存未启用，请检查 HTTPS 或本地服务器。'));