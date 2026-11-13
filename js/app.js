window.__STUDY_PLANNER_BOOTED__ = true;
import {homeBoard} from './home-board.js';
import {allTodayDone, fireworks} from './celebration.js';
import {learningView, nearbyDays, relativeDay} from './view-model.js';
import {subjects, today, instances, repeatLabel, shiftDate} from './repeat-engine.js';
import {openDB, read, write, emptyData, validate, defaultKidPerms, defaultPins} from './database.js';
import {saveTask, deleteTask, complete} from './task-manager.js';
import {client, merge, privateRepositories} from './github-sync.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[c]));

// 禁止 iOS / iPadOS Safari 捏合缩放整个页面
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('gesturechange', e => e.preventDefault());

const __memLS = {};
function safeGetStorage(key) {
  try { return localStorage.getItem(key) ?? __memLS[key] ?? null; } catch (e) { return __memLS[key] ?? null; }
}
function safeSetStorage(key, val) {
  __memLS[key] = String(val);
  try { localStorage.setItem(key, val); } catch (e) {}
}
function safeRemoveStorage(key) {
  delete __memLS[key];
  try { localStorage.removeItem(key); } catch (e) {}
}

// ================= 1. 账号配置与动态密码/权限引擎 =================
const ACCOUNTS = {
  baobao: { username: 'baobao', defaultPin: '1234', name: '刘诣辰', badge: '👶 宝宝账号', role: 'kid', avatar: '辰' },
  baba:   { username: 'baba',   defaultPin: '8888', name: '爸爸',   badge: '👨 父母管理', role: 'parent', avatar: '爸' },
  mama:   { username: 'mama',   defaultPin: '8888', name: '妈妈',   badge: '👩 父母管理', role: 'parent', avatar: '妈' }
};

let data = emptyData(),
    base = emptyData(),
    config = {},
    subject = 'all',
    filter = 'all',
    date = today(),
    busy = false,
    status = '本地模式',
    timer,
    screen = 'tasks',
    storageFailed = false,
    reportRange = 'week',
    logFilter = 'all';

let currentUser = null;
// 控制 iPad / 桌面端左中右三段式 iOS 抽屉动效与收展状态
let drawerCascadeAnim = true;
let centerDrawerCollapsed = false;

function getAccountPin(username) {
  const custom = data?.pins?.[username];
  if (custom && String(custom).trim()) return String(custom).trim();
  return ACCOUNTS[username]?.defaultPin || '';
}

function verifySavedSession() {
  try {
    const raw = safeGetStorage('lyc_study_auth_user');
    if (!raw) {
      // 首次打开默认进入父母预览或宝宝模式，也可随时点“切换”重新登录
      currentUser = null;
      return;
    }
    const saved = JSON.parse(raw);
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
    user: currentUser ? currentUser.name : '系统初始化',
    badge: currentUser ? currentUser.badge : '',
    timestamp: Date.now()
  };
}

// 一键载入示例任务（当列表为空时方便快速体验语数英核心任务卡片）
async function seedStarterTasks(silent = false) {
  const d = today();
  const samples = [
    {
      subjectId: 'chinese',
      title: '课外经典绘本/名著阅读 20 分钟',
      description: '朗读喜欢的章节，摘录 2 个好词好句并和爸爸妈妈分享读后感。',
      startDate: shiftDate(d, -5),
      endDate: '',
      reminderTime: '18:30',
      durationMinutes: 20,
      repeatRule: { type: 'daily', days: [1, 2, 3, 4, 5], interval: 1 },
      enabled: true
    },
    {
      subjectId: 'chinese',
      title: '生字词听写与古诗词背诵',
      description: '复习本单元生字词，熟练背诵古诗词并注意字音字形。',
      startDate: shiftDate(d, -5),
      endDate: '',
      reminderTime: '19:00',
      durationMinutes: 15,
      repeatRule: { type: 'daily', days: [1, 3, 5], interval: 1 },
      enabled: true
    },
    {
      subjectId: 'math',
      title: '每日口算与计算闯关 30 题',
      description: '限时 10 分钟完成混合运算练习，完成后用红笔自查订正。',
      startDate: shiftDate(d, -5),
      endDate: '',
      reminderTime: '19:20',
      durationMinutes: 15,
      repeatRule: { type: 'daily', days: [1, 2, 3, 4, 5], interval: 1 },
      enabled: true
    },
    {
      subjectId: 'math',
      title: '思维拓展应用题 2 道',
      description: '画线段图分析数量关系，写出完整解题步骤与答句。',
      startDate: shiftDate(d, -5),
      endDate: '',
      reminderTime: '19:45',
      durationMinutes: 20,
      repeatRule: { type: 'daily', days: [2, 4, 6], interval: 1 },
      enabled: true
    },
    {
      subjectId: 'english',
      title: '英语分级阅读与原声跟读 15 分钟',
      description: '听原声录音跟读 2 遍，注意连读与语调，大声开口朗读。',
      startDate: shiftDate(d, -5),
      endDate: '',
      reminderTime: '20:10',
      durationMinutes: 15,
      repeatRule: { type: 'daily', days: [1, 2, 3, 4, 5], interval: 1 },
      enabled: true
    }
  ];
  for (const item of samples) {
    saveTask(data, item);
  }
  // 标记往日任务全部完成（避免往期未完成任务叠加到今日产生重复卡片），今日完成 2 项、待学 3 项
  for (let offset = 1; offset <= 5; offset++) {
    const pastDate = shiftDate(d, -offset);
    const pastList = instances(data, pastDate, false);
    pastList.forEach(item => complete(data, item));
  }
  const todayList = instances(data, d, false);
  if (todayList[0]) complete(data, todayList[0]);
  if (todayList[2]) complete(data, todayList[2]);
  recordLog('add', '初始化语数英核心学习计划（5项）', 'all', '包含语文、数学、英语每日核心任务');
  safeSetStorage('lyc_study_seeded_v1', '1');
  if (!silent) toast('已载入 5 项语数英学习任务 🌟');
  await persist();
}

const dialog = $('#editor');
function toast(message) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(timer);
  timer = setTimeout(() => el.classList.remove('show'), 4000);
}

let syncTimer;
async function persist() {
  try {
    await write('data', data);
    storageFailed = false;
    status = config.token ? '等待同步' : '已保存到本机';
    clearTimeout(syncTimer);
    syncTimer = setTimeout(sync, 1500);
  } catch (e) {
    storageFailed = true;
    status = '保存失败';
    toast('本机存储失败，请立即导出备份，避免关闭页面。');
  }
  render();
}

// ================= 各页面专属视觉主题与特色配置 =================
const themes = {
  all: {
    name: '首页',
    navSub: '今日全科总览',
    icon: '☀',
    subtitle: '今日任务优先 · 每一份努力都闪闪发光',
    tag: '今日星辰舱',
    quoteTitle: '🌟 今日学习寄语',
    quoteText: '先完成最重要的今日任务，每打勾一项都是一次小胜利！',
    focusTags: ['专注当下', '今日事今日毕', '全科均衡'],
    art: `<svg class="hero-svg" viewBox="0 0 220 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="165" cy="70" r="55" fill="url(#homeGlow)" opacity="0.55"/>
      <circle cx="165" cy="70" r="38" stroke="currentColor" stroke-opacity="0.15" stroke-width="1.5" stroke-dasharray="4 4"/>
      <path d="M95 115 C125 65, 165 45, 210 30" stroke="url(#homeLine)" stroke-width="2.5" stroke-linecap="round"/>
      <g class="floating-badge" transform="translate(135, 32)">
        <rect x="0" y="0" width="56" height="56" rx="18" fill="white" fill-opacity="0.82" stroke="white" stroke-width="1.5"/>
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
  chinese: {
    name: '语文',
    navSub: '诗书山海 · 阅读',
    icon: '文',
    subtitle: '晨诵暮读 · 字里行间见天地',
    tag: '诗书山海',
    quoteTitle: '📜 诗书山海 · 每日古训',
    quoteText: '“读书破万卷，下笔如有神。” 每天坚持朗读与积累，语感自然水到渠成。',
    focusTags: ['大声朗读', '好词摘录', '书写工整'],
    art: `<svg class="hero-svg" viewBox="0 0 220 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M60 130 Q105 75 150 130 Z" fill="#D97706" fill-opacity="0.12"/>
      <path d="M110 130 Q160 55 215 130 Z" fill="#B45309" fill-opacity="0.16"/>
      <circle cx="178" cy="40" r="22" fill="#F59E0B" fill-opacity="0.24"/>
      <g transform="translate(118, 28)">
        <rect x="0" y="8" width="68" height="82" rx="12" transform="rotate(-6 0 8)" fill="white" fill-opacity="0.82" stroke="#F59E0B" stroke-opacity="0.35" stroke-width="1.5"/>
        <line x1="18" y1="24" x2="18" y2="72" stroke="#D97706" stroke-opacity="0.35" stroke-width="2" stroke-linecap="round"/>
        <line x1="34" y1="22" x2="34" y2="70" stroke="#D97706" stroke-opacity="0.35" stroke-width="2" stroke-linecap="round"/>
        <line x1="50" y1="20" x2="50" y2="68" stroke="#D97706" stroke-opacity="0.35" stroke-width="2" stroke-linecap="round"/>
        <rect x="42" y="48" width="36" height="36" rx="10" fill="#B45309" fill-opacity="0.92"/>
        <text x="60" y="73" text-anchor="middle" fill="#FFFBEB" font-size="20" font-weight="700" font-family="serif">文</text>
      </g>
    </svg>`
  },
  math: {
    name: '数学',
    navSub: '逻辑宇宙 · 思维',
    icon: 'π',
    subtitle: '严谨推理 · 探索数字与几何的奥秘',
    tag: '逻辑宇宙',
    quoteTitle: '📐 逻辑宇宙 · 思维锦囊',
    quoteText: '审题先圈关键词，草稿纸分区打草稿，算完逆向验算一遍，准确率提升 90%！',
    focusTags: ['圈画条件', '规范草稿', '逆向验算'],
    art: `<svg class="hero-svg" viewBox="0 0 220 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="160" cy="70" r="52" stroke="#7C3AED" stroke-opacity="0.16" stroke-width="1.5" stroke-dasharray="5 5"/>
      <polygon points="155,18 202,98 110,98" fill="#8B5CF6" fill-opacity="0.12" stroke="#7C3AED" stroke-opacity="0.32" stroke-width="1.5" stroke-linejoin="round"/>
      <g transform="translate(105, 32)">
        <rect x="0" y="18" width="54" height="54" rx="16" transform="rotate(-10 0 18)" fill="white" fill-opacity="0.86" stroke="#8B5CF6" stroke-opacity="0.32" stroke-width="1.5"/>
        <text x="27" y="54" text-anchor="middle" fill="#6D28D9" font-size="30" font-weight="800" font-family="serif" transform="rotate(-10 27 45)">π</text>
      </g>
      <g transform="translate(154, 62)">
        <rect x="0" y="0" width="52" height="30" rx="9" fill="#6D28D9" fill-opacity="0.9"/>
        <text x="26" y="19" text-anchor="middle" fill="white" font-size="11" font-weight="700">a²+b²=c²</text>
      </g>
    </svg>`
  },
  english: {
    name: '英语',
    navSub: '世界对话 · 语感',
    icon: 'Aa',
    subtitle: '听说先行 · 用声音与世界自信对话',
    tag: '世界对话',
    quoteTitle: '🌍 世界对话 · 语感秘籍',
    quoteText: '“Practice makes perfect!” 先盲听抓大意，再逐句跟读模仿语音语调。',
    focusTags: ['原声跟读', '自然拼读', '情境造句'],
    art: `<svg class="hero-svg" viewBox="0 0 220 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="162" cy="70" r="48" fill="#10B981" fill-opacity="0.12"/>
      <g transform="translate(104, 24)">
        <rect x="0" y="0" width="76" height="46" rx="16" fill="white" fill-opacity="0.88" stroke="#10B981" stroke-opacity="0.32" stroke-width="1.5"/>
        <path d="M18 46 L12 56 L28 46 Z" fill="white" fill-opacity="0.88"/>
        <text x="38" y="29" text-anchor="middle" fill="#047857" font-size="16" font-weight="800">Hello!</text>
      </g>
      <g transform="translate(142, 62)">
        <rect x="0" y="0" width="62" height="44" rx="14" fill="#059669" fill-opacity="0.92"/>
        <path d="M46 44 L54 53 L36 44 Z" fill="#059669" fill-opacity="0.92"/>
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
        <input name="pin" id="login-pin" type="password" required autocomplete="current-password" placeholder="请输入密码（默认宝宝1234 / 父母8888）">
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
    safeSetStorage('lyc_study_auth_user', JSON.stringify({ username: acc.username, pin: p }));
    if (!isParent() && screen === 'settings') screen = 'tasks';
    if (!canViewReports() && screen === 'reports') screen = 'tasks';
    drawerCascadeAnim = true;
    toast(`欢迎回来，${acc.name}！`);
    render();
  };
}

function logout() {
  show(`<form id="switch-account-form">
    <div class="modal-head">
      <h2>👤 切换登录账号</h2>
      <button type="button" data-close aria-label="关闭">✕</button>
    </div>
    <p class="hint" style="margin:6px 0 12px">当前登录：<strong>${esc(currentUser?.name || '')}</strong>（${esc(currentUser?.badge || '')}）。请选择要切换的角色并输入密码：</p>
    <div class="role-selector" style="margin-bottom:12px">
      <button type="button" class="role-chip selected" data-switch-user="baobao">👶 宝宝 (刘诣辰)</button>
      <button type="button" class="role-chip" data-switch-user="baba">👨 爸爸</button>
      <button type="button" class="role-chip" data-switch-user="mama">👩 妈妈</button>
    </div>
    <input type="hidden" name="username" id="switch-user-input" value="baobao">
    <label>登录密码
      <input name="pin" id="switch-pin-input" type="password" required placeholder="输入对应角色密码（宝宝1234 / 父母8888）">
    </label>
    <p id="switch-error" class="login-error" role="alert"></p>
    <div class="buttons" style="margin-top:12px">
      <button type="submit" class="primary" style="flex:1">确认切换账号</button>
      <button type="button" id="full-logout-btn" class="danger">退出到登录页</button>
    </div>
  </form>`);
  const uInput = $('#switch-user-input'), pInput = $('#switch-pin-input'), errEl = $('#switch-error');
  dialog.querySelectorAll('[data-switch-user]').forEach(btn => {
    btn.onclick = () => {
      dialog.querySelectorAll('[data-switch-user]').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      uInput.value = btn.dataset.switchUser;
      errEl.textContent = '';
      pInput.focus();
    };
  });
  $('#full-logout-btn').onclick = () => {
    dialog.close();
    currentUser = null;
    safeRemoveStorage('lyc_study_auth_user');
    render();
  };
  $('#switch-account-form').onsubmit = e => {
    e.preventDefault();
    const u = uInput.value.trim().toLowerCase(), p = pInput.value.trim();
    const acc = ACCOUNTS[u];
    if (!acc || getAccountPin(u) !== p) {
      errEl.textContent = '密码不正确，请重试';
      return;
    }
    currentUser = acc;
    safeSetStorage('lyc_study_auth_user', JSON.stringify({ username: acc.username, pin: p }));
    if (!isParent() && screen === 'settings') screen = 'tasks';
    if (!canViewReports() && screen === 'reports') screen = 'tasks';
    dialog.close();
    drawerCascadeAnim = true;
    toast(`已切换至：${acc.name}`);
    render();
  };
}

// ================= 3. 后台看板：高颜值星际数据舱 + 权限控制 + 审计日志 =================
function computeStats(daysCount) {
  const end = today();
  const dates = [];
  for (let i = daysCount - 1; i >= 0; i--) dates.push(shiftDate(end, -i));
  let total = 0, done = 0, activeDays = 0, totalMinutes = 0, doneMinutes = 0;
  const bySub = {
    chinese: { name: '语文', icon: '文', tag: '诗书积累', total: 0, done: 0, minutes: 0, color: '#d97706' },
    math:    { name: '数学', icon: 'π',  tag: '逻辑思维', total: 0, done: 0, minutes: 0, color: '#7c3aed' },
    english: { name: '英语', icon: 'Aa', tag: '世界对话', total: 0, done: 0, minutes: 0, color: '#059669' }
  };
  const daily = [];
  for (const d of dates) {
    const items = instances(data, d, false);
    const dTotal = items.length;
    const dDone = items.filter(x => x.done).length;
    total += dTotal;
    done += dDone;
    if (dDone > 0) activeDays++;
    for (const item of items) {
      const mins = Number(item.durationMinutes) || 20;
      totalMinutes += mins;
      if (item.done) doneMinutes += mins;
      if (bySub[item.subjectId]) {
        bySub[item.subjectId].total++;
        if (item.done) {
          bySub[item.subjectId].done++;
          bySub[item.subjectId].minutes += mins;
        }
      }
    }
    daily.push({
      date: d,
      label: `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`,
      isToday: d === end,
      total: dTotal,
      done: dDone,
      rate: dTotal ? Math.round((dDone / dTotal) * 100) : 0
    });
  }
  const rate = total ? Math.round((done / total) * 100) : 0;
  return {
    daysCount,
    startDate: dates[0],
    endDate: end,
    total,
    done,
    pending: total - done,
    rate,
    activeDays,
    totalMinutes,
    doneMinutes,
    bySub,
    daily
  };
}

function reportsHTML() {
  const days = reportRange === 'week' ? 7 : 30;
  const st = computeStats(days);
  const chartDays = reportRange === 'week' ? st.daily : st.daily.slice(-14);
  const perms = data.kidPerms || defaultKidPerms();
  const allLogs = Object.values(data.logs || {}).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  const filteredLogs = allLogs.filter(l => logFilter === 'all' || l.action === logFilter);

  const ringRadius = 42;
  const ringCircum = +(2 * Math.PI * ringRadius).toFixed(1);
  const ringOffset = +(ringCircum * (1 - st.rate / 100)).toFixed(1);
  const medalTitle = st.rate >= 85 ? '🏆 卓越学习之星' : st.rate >= 60 ? '🌟 稳步进阶达人' : '🌱 每日蓄力起航';

  const actionLabels = {
    add:    { text: '添加任务', cls: 'log-add',  icon: '➕' },
    edit:   { text: '编辑修改', cls: 'log-edit', icon: '✏️' },
    delete: { text: '删除任务', cls: 'log-del',  icon: '🗑️' }
  };

  return `<section class="reports-view single-stage-drawer ${drawerCascadeAnim ? 'ios-drawer-cascade' : ''}">
    <div class="reports-hero">
      <div class="reports-hero-main">
        <div class="reports-hero-badges">
          <span class="report-badge-pill">📊 ${isParent() ? '父母管理驾驶舱 · 统计与权限中心' : '专属学习成长报告'}</span>
          <span class="report-medal-pill">${medalTitle}</span>
        </div>
        <h1>学习${reportRange === 'week' ? '周报' : '月报'}与管理看板</h1>
        <p class="reports-hero-sub">统计周期：${st.startDate} 至 ${st.endDate}（近 ${days} 天） · 累计专注约 <strong>${st.doneMinutes}</strong> 分钟</p>
        <div class="range-switch">
          <button type="button" data-range="week" class="${reportRange === 'week' ? 'selected' : ''}">📅 近 7 天周报</button>
          <button type="button" data-range="month" class="${reportRange === 'month' ? 'selected' : ''}">🗓️ 近 30 天月报</button>
        </div>
      </div>
      <div class="reports-hero-ring" aria-label="周期总完成率 ${st.rate}%">
        <svg viewBox="0 0 108 108" class="ring-svg">
          <defs>
            <linearGradient id="reportRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#38bdf8"/>
              <stop offset="50%" stop-color="#818cf8"/>
              <stop offset="100%" stop-color="#34d399"/>
            </linearGradient>
          </defs>
          <circle cx="54" cy="54" r="${ringRadius}" class="ring-track"/>
          <circle cx="54" cy="54" r="${ringRadius}" class="ring-fill" stroke="url(#reportRingGrad)" stroke-dasharray="${ringCircum}" stroke-dashoffset="${ringOffset}"/>
        </svg>
        <div class="ring-center-text">
          <strong>${st.rate}<small>%</small></strong>
          <span>综合达成</span>
        </div>
      </div>
    </div>

    <div class="report-kpis">
      <div class="kpi-card kpi-blue">
        <div class="kpi-top"><span class="kpi-icon">🎯</span><span class="kpi-tag">核心指标</span></div>
        <strong>${st.rate}<small>%</small></strong>
        <span class="kpi-label">总计划完成率</span>
        <div class="kpi-mini-bar"><i style="width:${st.rate}%"></i></div>
      </div>
      <div class="kpi-card kpi-green">
        <div class="kpi-top"><span class="kpi-icon">✅</span><span class="kpi-tag">约 ${st.doneMinutes} 分钟</span></div>
        <strong>${st.done}<small> 项</small></strong>
        <span class="kpi-label">已打卡完成任务</span>
        <em>共安排 ${st.total} 项学习任务</em>
      </div>
      <div class="kpi-card kpi-warm">
        <div class="kpi-top"><span class="kpi-icon">⏳</span><span class="kpi-tag">${st.pending ? '继续加油' : '全部清零'}</span></div>
        <strong>${st.pending}<small> 项</small></strong>
        <span class="kpi-label">周期内待完成</span>
        <em>${st.pending === 0 ? '太棒了！无遗留任务' : '按步就班逐项击破'}</em>
      </div>
      <div class="kpi-card kpi-purple">
        <div class="kpi-top"><span class="kpi-icon">🔥</span><span class="kpi-tag">打卡习惯</span></div>
        <strong>${st.activeDays}<small> / ${days}天</small></strong>
        <span class="kpi-label">活跃学习天数</span>
        <em>活跃度 ${Math.round((st.activeDays / days) * 100)}%</em>
      </div>
    </div>

    <div class="report-grid">
      <section class="panel report-panel">
        <div class="report-panel-head">
          <div>
            <h2>📚 三大学科完成度与学时分布</h2>
            <p>直观对比语、数、英各科执行力与投入时长</p>
          </div>
          <span class="panel-chip">三科均衡</span>
        </div>
        <div class="sub-bars">
          ${Object.entries(st.bySub).map(([id, s]) => {
            const p = s.total ? Math.round((s.done / s.total) * 100) : 0;
            return `<div class="sub-bar-card sub-card-${id}">
              <div class="sub-bar-head">
                <span class="nav-icon icon-${id}">${s.icon}</span>
                <div class="sub-bar-title">
                  <strong>${s.name} <em>${s.tag}</em></strong>
                  <small>已完成 <b>${s.done}</b> / ${s.total} 项 · 累计专注 ${s.minutes} 分钟</small>
                </div>
                <div class="sub-bar-pct-wrap">
                  <b class="sub-bar-pct">${p}%</b>
                  <small>${s.total - s.done ? `剩 ${s.total - s.done} 项` : '已满格'}</small>
                </div>
              </div>
              <div class="track"><i class="bar-${id}" style="width:${p}%"></i></div>
            </div>`;
          }).join('')}
        </div>
      </section>

      <section class="panel report-panel">
        <div class="report-panel-head">
          <div>
            <h2>📈 每日打卡趋势图（${reportRange === 'week' ? '近 7 天' : '最近 14 天'}）</h2>
            <p>柱高代表当日完成率，绿色代表当日 100% 满格达成</p>
          </div>
          <span class="panel-chip">每日能量</span>
        </div>
        <div class="daily-chart">
          ${chartDays.map(d => {
            const stateCls = d.total === 0 ? 'is-empty' : d.rate === 100 ? 'is-full' : d.done > 0 ? 'is-partial' : 'is-zero';
            return `<div class="chart-col ${d.isToday ? 'is-today' : ''}">
              <span class="chart-rate-lbl">${d.total ? d.rate + '%' : '-'}</span>
              <div class="chart-bar-wrap" title="${d.date}: 完成 ${d.done}/${d.total} 项 (${d.rate}%)">
                <div class="chart-bar ${stateCls}" style="height:${Math.max(d.total ? 12 : 6, d.rate)}%"></div>
              </div>
              <strong>${d.done}/${d.total}</strong>
              <small>${d.isToday ? '今天' : d.label}</small>
            </div>`;
          }).join('')}
        </div>
      </section>
    </div>

    ${isParent() ? `<section class="panel perm-panel">
      <div class="perm-header">
        <div>
          <h2>🛡️ 宝宝账号（刘诣辰）权限动态控制中心</h2>
          <p>爸爸妈妈可随时开启或关闭孩子的对应操作权限，修改后实时同步至所有设备（设置与同步中心始终仅限父母访问）。</p>
        </div>
        ${perms.updatedAt ? `<small class="perm-meta">最近由 ${esc(perms.updatedBy)} 更新于 ${esc(new Date(perms.updatedAt).toLocaleString('zh-CN'))}</small>` : ''}
      </div>
      <div class="perm-grid">
        <label class="perm-switch-card ${perms.canAdd ? 'is-on' : ''}">
          <span class="perm-card-icon">➕</span>
          <div class="perm-card-text"><strong>允许添加新任务</strong><small>开启后宝宝可自主新增学习计划</small></div>
          <input type="checkbox" class="ios-switch" data-perm="canAdd" ${perms.canAdd ? 'checked' : ''}>
        </label>
        <label class="perm-switch-card ${perms.canEdit ? 'is-on' : ''}">
          <span class="perm-card-icon">✏️</span>
          <div class="perm-card-text"><strong>允许编辑修改任务</strong><small>开启后宝宝可修改任务内容与暂停计划</small></div>
          <input type="checkbox" class="ios-switch" data-perm="canEdit" ${perms.canEdit ? 'checked' : ''}>
        </label>
        <label class="perm-switch-card ${perms.canDelete ? 'is-on' : ''}">
          <span class="perm-card-icon">🗑️</span>
          <div class="perm-card-text"><strong>允许删除任务</strong><small>开启后宝宝任务卡上将显示删除按钮</small></div>
          <input type="checkbox" class="ios-switch" data-perm="canDelete" ${perms.canDelete ? 'checked' : ''}>
        </label>
        <label class="perm-switch-card ${perms.canReport ? 'is-on' : ''}">
          <span class="perm-card-icon">📊</span>
          <div class="perm-card-text"><strong>允许查看统计周报</strong><small>开启后宝宝也能进入周报看板查看成长</small></div>
          <input type="checkbox" class="ios-switch" data-perm="canReport" ${perms.canReport ? 'checked' : ''}>
        </label>
      </div>
    </section>` : ''}

    <section class="panel audit-panel">
      <div class="audit-head">
        <div>
          <h2>📋 任务增删改安全审计日志</h2>
          <p>自动记录每一次添加、修改和删除任务的责任人与精确时间（共 ${allLogs.length} 条记录）。</p>
        </div>
        <div class="range-switch audit-filter-switch">
          ${[['all', '全部记录'], ['add', '➕ 添加'], ['edit', '✏️ 修改'], ['delete', '🗑️ 删除']].map(([k, n]) => `<button type="button" data-log-filter="${k}" class="${logFilter === k ? 'selected' : ''}">${n}</button>`).join('')}
        </div>
      </div>
      <div class="audit-list">
        ${filteredLogs.slice(0, 60).map(item => {
          const info = actionLabels[item.action] || { text: '操作', cls: 'log-edit', icon: '📌' };
          return `<div class="audit-row">
            <span class="audit-tag ${info.cls}">${info.icon} ${info.text}</span>
            <div class="audit-main">
              <strong><span class="audit-sub-pill">${esc(item.subjectName)}</span>${esc(item.taskTitle)}</strong>
              ${item.detail ? `<small>${esc(item.detail)}</small>` : ''}
            </div>
            <div class="audit-meta">
              <span class="audit-user">操作人：<b>${esc(item.user)}</b></span>
              <time>${esc(new Date(item.timestamp).toLocaleString('zh-CN'))}</time>
            </div>
          </div>`;
        }).join('') || `<div class="empty audit-empty"><span class="empty-symbol">🛡️</span><h3>暂无符合条件的操作记录</h3><p>新增、编辑或删除学习任务后，这里会自动生成安全审计时间轴。</p></div>`}
      </div>
    </section>
  </section>`;
}

// ================= 4. 主界面渲染（左中右三段式 iOS 抽屉 + 手机端任务核心优先） =================
function render() {
  verifySavedSession();
  if (!currentUser) {
    $('#app').className = 'theme-all';
    $('#app').innerHTML = loginHTML();
    bindLogin();
    return;
  }
  const parentMode = isParent();
  const allowAdd = canAddTask(),
        allowEdit = canEditTask(),
        allowDel = canDeleteTask(),
        allowRep = canViewReports();

  if (!parentMode && screen === 'settings') screen = 'tasks';
  if (!allowRep && screen === 'reports') screen = 'tasks';

  const theme = themes[subject];
  const view = learningView(data, subject, date);
  const rows = view.rows;
  const day = relativeDay(date);
  const home = subject === 'all';
  const filteredRows = rows.filter(t => filter === 'all' || (filter === 'done' ? t.done : !t.done));

  $('#app').className = `theme-${screen === 'settings' || screen === 'reports' ? 'all' : subject} screen-${screen} role-${currentUser.role}`;

  // 圆环进度参数（供中栏小组件使用）
  const rRadius = 32;
  const rCircum = +(2 * Math.PI * rRadius).toFixed(1);
  const rOffset = +(rCircum * (1 - view.percent / 100)).toFixed(1);

  $('#app').innerHTML = `
  <aside class="app-sidebar" aria-label="主导航侧栏">
    <div class="sidebar-brand-head">
      <a class="brand" href="#" id="brand-home">
        <span class="brand-logo">✦</span>
        <div class="brand-text">
          <strong>小小学习家</strong>
          <small>KIDS STUDY PLANNER</small>
        </div>
      </a>
    </div>

    <div class="nav-caption">学习空间 · 抽屉导航</div>
    <nav aria-label="学习导航">
      ${Object.entries(themes).map(([id, s]) => {
        const n = id === 'all' ? learningView(data, 'all', date).pending : learningView(data, id, date).pending;
        const isActive = subject === id && screen === 'tasks';
        return `<button type="button" data-sub="${id}" class="${isActive ? 'active' : ''}">
          <span class="nav-icon icon-${id}">${s.icon}</span>
          <span class="nav-label-group">
            <strong>${s.name}</strong>
            <small>${s.navSub}</small>
          </span>
          ${n ? `<b class="${id === 'all' ? 'badge-soft' : ''}">${n}</b>` : ''}
        </button>`;
      }).join('')}
      ${allowRep ? `<button type="button" id="nav-reports" class="${screen === 'reports' ? 'active' : ''}">
        <span class="nav-icon icon-reports">📊</span>
        <span class="nav-label-group">
          <strong>周报与看板</strong>
          <small>统计 · 权限 · 日志</small>
        </span>
      </button>` : ''}
      ${parentMode ? `<button type="button" id="settings" class="${screen === 'settings' ? 'active' : ''}">
        <span class="nav-icon icon-settings">⚙</span>
        <span class="nav-label-group">
          <strong>设置与同步</strong>
          <small>密码 · 云端 · 备份</small>
        </span>
      </button>` : ''}
    </nav>

    ${screen === 'tasks' ? `<div class="drawer-stage-control">
      <button type="button" id="sidebar-drawer-toggle" class="drawer-pill-btn" title="展开或收起中间概览抽屉">
        <span>${centerDrawerCollapsed ? '⇥ 展开中栏抽屉' : '⇤ 收起中栏抽屉'}</span>
      </button>
    </div>` : ''}

    <div class="aside-bottom">
      <div class="sidebar-user-box">
        <span class="user-avatar-circle">${esc(currentUser.avatar || currentUser.name.slice(0, 1))}</span>
        <div class="user-box-info">
          <strong>${esc(currentUser.name)}</strong>
          <small>${esc(currentUser.badge)}</small>
        </div>
        <button type="button" class="switch-user-btn" data-logout title="切换登录账号">切换</button>
      </div>
      <button type="button" id="sync" class="sidebar-sync-btn" title="点击立即同步">
        <span class="sync-dot ${status.includes('失败') ? 'err' : status.includes('已同步') ? 'ok' : ''}"></span>
        <span>☁ ${esc(status)}</span>
      </button>
    </div>
  </aside>

  <main>
    ${screen === 'settings'
      ? settingsHTML()
      : screen === 'reports'
        ? reportsHTML()
        : `<div class="ipad-shell ${centerDrawerCollapsed ? 'center-collapsed' : ''} ${drawerCascadeAnim ? 'ios-drawer-cascade' : ''}">
          <button type="button" class="drawer-edge-handle" id="toggle-center-drawer" aria-label="${centerDrawerCollapsed ? '展开概览抽屉' : '收起概览抽屉'}" title="${centerDrawerCollapsed ? '拉开概览抽屉' : '收起概览抽屉'}">
            <span>${centerDrawerCollapsed ? '›' : '‹'}</span>
          </button>
          <!-- 第二段：中间概览与日历抽屉 (Stage 2 Center Drawer) -->
          <div class="ipad-center">

            <!-- 顶部紧凑主题横幅（手机端自动融合成轻量状态条） -->
            <section class="hero-banner hero-${home ? 'home' : subject}">
              <div class="hero-content">
                <div class="hero-badges">
                  <span class="hero-pill">${home ? '✦ 今日闪闪发光' : `0${['chinese', 'math', 'english'].indexOf(subject) + 1} · ${theme.tag}`}</span>
                  <span class="mobile-inline-progress">${esc(day)} ${view.done}/${view.total} · ${view.percent}%</span>
                </div>
                <h1>${home ? '刘诣辰的学习计划' : `${theme.name}<span>学习计划</span>`}</h1>
                <p class="hero-sub">${theme.subtitle}</p>
              </div>
              <div class="hero-right-actions">
                <button type="button" class="mobile-account-chip" data-logout title="点击切换账号">
                  <span class="user-dot"></span>
                  <span>${esc(currentUser.name)}</span>
                  <small>切换</small>
                </button>
                ${parentMode ? `<button type="button" id="mobile-settings" class="mobile-icon-chip" aria-label="设置">⚙</button>` : ''}
              </div>
              <div class="hero-visual" aria-hidden="true">${theme.art}</div>
            </section>

            <!-- 中栏核心组件 1：五日学习日历滑块 -->
            <section class="day-planner widget-card" aria-label="日期计划">
              <div class="planner-heading">
                <h2>📅 ${home ? '学习日历' : theme.name + '日历'}</h2>
                <label class="date" aria-label="选择日期">
                  <input type="date" id="date" value="${date}" aria-label="查看日期">
                </label>
              </div>
              <div class="day-tabs">
                ${nearbyDays(data).map(d => {
                  const dotCls = d.total === 0 ? 'dot-none' : d.pending === 0 ? 'dot-done' : 'dot-pending';
                  return `<button type="button" data-date="${d.date}" class="${d.date === date ? 'selected' : ''}" aria-pressed="${d.date === date}">
                    <span>${d.label}</span>
                    <small>${Number(d.date.slice(5, 7))}/${Number(d.date.slice(8))}</small>
                    <i class="day-dot ${dotCls}"></i>
                  </button>`;
                }).join('')}
              </div>
            </section>

            <!-- 中栏核心组件 2：iOS 环形进度 + 待学/已学筛选舱 -->
            <section class="stats widget-card" aria-label="${home ? '全部科目' : theme.name}统计">
              <div class="stat progress">
                <div class="progress-ring-box">
                  <svg viewBox="0 0 80 80" class="mini-ring-svg">
                    <circle cx="40" cy="40" r="${rRadius}" class="mini-ring-track"/>
                    <circle cx="40" cy="40" r="${rRadius}" class="mini-ring-fill" stroke-dasharray="${rCircum}" stroke-dashoffset="${rOffset}"/>
                  </svg>
                  <strong class="mini-ring-pct">${view.percent}<small>%</small></strong>
                </div>
                <div class="progress-meta-text">
                  <span>${esc(day)}完成度 <b>${view.done}/${view.total} 项</b></span>
                  <div class="track"><i style="width:${view.percent}%"></i></div>
                  <small>⏱ 预计总时长 ${view.totalMinutes} 分钟</small>
                </div>
              </div>
              <button type="button" class="stat warm ${filter === 'pending' ? 'stat-active' : ''}" data-filter="pending">
                <span class="stat-label">🔥 待学习</span>
                <strong>${view.pending}<small> 项</small></strong>
              </button>
              <button type="button" class="stat green ${filter === 'done' ? 'stat-active' : ''}" data-filter="done">
                <span class="stat-label">✅ 已学习</span>
                <strong>${view.done}<small> 项</small></strong>
              </button>
            </section>

            <!-- 中栏核心组件 3：各页面专属特色学习锦囊（填补中栏结构，手机端自动隐藏不占空间） -->
            <section class="subject-feature-widget widget-card feature-${subject}">
              <div class="feature-head">
                <strong>${theme.quoteTitle}</strong>
                <span class="feature-tag">${theme.tag}</span>
              </div>
              <p>${theme.quoteText}</p>
              <div class="feature-pills">
                ${theme.focusTags.map(t => `<span>✦ ${t}</span>`).join('')}
              </div>
            </section>
          </div>

          <!-- 第三段：右侧核心学习任务抽屉 (Stage 3 Primary Task Drawer) -->
          <div class="ipad-right">
            <div class="right-top-status-bar ${centerDrawerCollapsed ? 'always-show' : 'portrait-only'}">
              <button type="button" class="expand-center-banner" id="expand-center-btn">
                <span>⇥ ${centerDrawerCollapsed ? '展开' : '日历与概览抽屉'} · ${esc(day)} (${date.slice(5)})</span>
                <strong>已完成 ${view.done}/${view.total} 项 (${view.percent}%)</strong>
              </button>
            </div>

            ${home ? homeBoard(data, date) : ''}

            <section class="workspace ${home ? 'home-workspace' : 'subject-workspace'} workspace-${subject}">
              <div class="section-head">
                <div class="section-title-group">
                  <div class="section-title-row">
                    <h2>${home ? `🎯 ${esc(day)}核心学习任务` : `${esc(day)}${theme.name}学习任务`}</h2>
                    <span class="task-count-pill">${filteredRows.length} 项</span>
                  </div>
                  <p>${view.total} 项当日计划 · 待学 <b>${view.pending}</b> 项 / 已学 <b>${view.done}</b> 项${date === today() ? '（含往期待办）' : ''}</p>
                </div>
                <div class="section-head-actions">
                  ${allowAdd ? `<button type="button" class="primary add-task-btn" id="add">＋ 添加任务</button>` : ''}
                </div>
              </div>

              <div class="toolbar">
                <div class="filters" role="tablist" aria-label="任务状态筛选">
                  ${[
                    ['all', `全部 (${view.total})`],
                    ['pending', `待学习 (${view.pending})`],
                    ['done', `已学习 (${view.done})`]
                  ].map(([id, name]) => `<button type="button" data-filter="${id}" class="${filter === id ? 'selected' : ''}">${name}</button>`).join('')}
                </div>
                ${home ? `<div class="subject-quick-pills">
                  ${subjects.map(s => `<button type="button" class="sub-mini-pill pill-${s.id}" data-sub="${s.id}">${s.name} ›</button>`).join('')}
                </div>` : ''}
              </div>

              <div class="cards">
                ${filteredRows.map((t, idx) => cardHTML(t, idx)).join('') || `
                  <div class="empty">
                    <span class="empty-symbol">${theme.icon}</span>
                    <h3>${filter === 'done' ? '还没有已完成的任务哦' : filter === 'pending' ? `太棒了！${esc(day)}${home ? '' : theme.name}待办已全部完成 🎉` : `暂无${esc(day)}${home ? '' : theme.name}学习任务`}</h3>
                    <p>${filter === 'done'
                      ? '勾选任务左侧的方框即可打卡完成任务并燃放礼花！'
                      : allowAdd
                        ? `点击右上角「＋ 添加任务」安排${esc(day)}的学习计划，或一键载入示例任务体验。`
                        : '今天还没有安排这项学习任务哦，稍后再来看看吧！'}</p>
                    ${allowAdd && Object.keys(data.tasks || {}).length === 0 ? `<button type="button" class="primary seed-btn" id="seed-tasks">✨ 一键载入语数英示例任务</button>` : ''}
                  </div>
                `}
              </div>

              ${allowEdit ? pausedHTML() : ''}
            </section>
          </div>
        </div>`
    }
  </main>

  <nav class="mobile-nav" aria-label="底部导航">
    ${Object.entries(themes).map(([id, s]) => `<button type="button" data-sub="${id}" class="${subject === id && screen === 'tasks' ? 'active' : ''}">
      <span class="nav-icon icon-${id}">${s.icon}</span>
      <small>${s.name}</small>
    </button>`).join('')}
    ${allowRep ? `<button type="button" id="mobile-reports" class="${screen === 'reports' ? 'active' : ''}">
      <span class="nav-icon">📊</span>
      <small>看板</small>
    </button>` : ''}
  </nav>`;

  // 动画播放一次后复位标志，避免普通勾选时整栏重跳
  drawerCascadeAnim = false;

  // 绑定事件
  document.querySelectorAll('[data-logout]').forEach(b => (b.onclick = logout));

  const switchSubject = newSub => {
    if (screen === 'tasks' && subject === newSub && window.innerWidth > 700) {
      centerDrawerCollapsed = !centerDrawerCollapsed;
      drawerCascadeAnim = true;
      render();
      return;
    }
    subject = newSub;
    screen = 'tasks';
    filter = 'all';
    centerDrawerCollapsed = false;
    drawerCascadeAnim = true;
    render();
  };

  document.querySelectorAll('[data-sub]').forEach(b => {
    b.onclick = () => switchSubject(b.dataset.sub);
  });

  if ($('#brand-home')) {
    $('#brand-home').onclick = e => {
      e.preventDefault();
      switchSubject('all');
    };
  }

  document.querySelectorAll('[data-filter]').forEach(b => {
    b.onclick = () => {
      filter = b.dataset.filter;
      screen = 'tasks';
      render();
    };
  });

  document.querySelectorAll('[data-date]').forEach(b => {
    b.onclick = () => {
      date = b.dataset.date;
      filter = 'all';
      render();
    };
  });

  document.querySelectorAll('.mobile-nav [data-sub]').forEach(b => {
    const id = b.dataset.sub;
    if (id !== 'all') {
      const n = learningView(data, id, date).pending;
      if (n) {
        const badge = document.createElement('b');
        badge.className = 'mobile-badge';
        badge.textContent = n;
        b.append(badge);
      }
    }
  });

  const openSettings = () => {
    if (!isParent()) return;
    screen = 'settings';
    drawerCascadeAnim = true;
    render();
  };
  const openReports = () => {
    if (!canViewReports()) return;
    screen = 'reports';
    drawerCascadeAnim = true;
    render();
  };

  if ($('#settings')) $('#settings').onclick = openSettings;
  if ($('#mobile-settings')) $('#mobile-settings').onclick = openSettings;
  if ($('#nav-reports')) $('#nav-reports').onclick = openReports;
  if ($('#mobile-reports')) $('#mobile-reports').onclick = openReports;
  if ($('#sync')) $('#sync').onclick = sync;
  if ($('#seed-tasks')) $('#seed-tasks').onclick = () => seedStarterTasks(false);

  // 中栏抽屉收展控制
  const toggleCenterDrawer = () => {
    centerDrawerCollapsed = !centerDrawerCollapsed;
    drawerCascadeAnim = true;
    render();
  };
  if ($('#toggle-center-drawer')) $('#toggle-center-drawer').onclick = toggleCenterDrawer;
  if ($('#sidebar-drawer-toggle')) $('#sidebar-drawer-toggle').onclick = toggleCenterDrawer;
  if ($('#expand-center-btn')) $('#expand-center-btn').onclick = toggleCenterDrawer;

  if (screen === 'settings') {
    bindSettings();
  } else if (screen === 'reports') {
    document.querySelectorAll('[data-range]').forEach(b => {
      b.onclick = () => {
        reportRange = b.dataset.range;
        render();
      };
    });
    document.querySelectorAll('[data-log-filter]').forEach(b => {
      b.onclick = () => {
        logFilter = b.dataset.logFilter;
        render();
      };
    });
    document.querySelectorAll('[data-perm]').forEach(chk => {
      chk.onchange = async e => {
        if (!isParent()) return;
        const key = e.target.dataset.perm;
        if (!data.kidPerms) data.kidPerms = defaultKidPerms();
        data.kidPerms[key] = e.target.checked;
        data.kidPerms.updatedAt = Date.now();
        data.kidPerms.updatedBy = currentUser.name;
        toast(`已${e.target.checked ? '开启' : '关闭'}宝宝对应权限`);
        await persist();
      };
    });
  } else {
    if ($('#add') && allowAdd) $('#add').onclick = () => edit();
    if ($('#date')) {
      $('#date').onchange = e => {
        if (e.target.value) {
          date = e.target.value;
          filter = 'all';
          render();
        }
      };
    }
    document.querySelectorAll('[data-action]').forEach(b => {
      b.onclick = () => {
        const t = rows.find(item => item.key === b.dataset.key);
        if (!t) return;
        if (b.dataset.action === 'complete') {
          const wasDone = allTodayDone(data);
          complete(data, t);
          persist().then(() => {
            if (!storageFailed && !wasDone && t.date === today() && allTodayDone(data)) fireworks();
            else if (!t.done) toast('太棒了！完成一项学习任务 🌟');
          });
        }
        if (allowEdit && b.dataset.action === 'edit') edit(t);
        if (allowDel && b.dataset.action === 'delete') remove(t);
      };
    });
    if (allowEdit) {
      document.querySelectorAll('[data-resume]').forEach(b => {
        b.onclick = () => edit({ ...data.tasks[b.dataset.resume], date });
      });
    }
  }
}

const SUB_TAG_META = {
  chinese: { name: '语文', icon: '文', cls: 'tag-chinese' },
  math:    { name: '数学', icon: 'π',  cls: 'tag-math' },
  english: { name: '英语', icon: 'Aa', cls: 'tag-english' }
};

function cardHTML(t, idx = 0) {
  const allowEdit = canEditTask(), allowDel = canDeleteTask();
  const subMeta = SUB_TAG_META[t.subjectId] || { name: '综合', icon: '✦', cls: 'tag-all' };
  const mins = Number(t.durationMinutes) || 20;
  return `<article class="task task-${esc(t.subjectId)} ${t.done ? 'completed' : ''}" style="--card-idx:${Math.min(idx, 8)}">
    <button type="button" class="check" data-action="complete" data-key="${esc(t.key)}" aria-label="${t.done ? '撤销完成' : '完成任务'}">
      <span>${t.done ? '✓' : ''}</span>
    </button>
    <div class="task-body">
      <div class="task-top-row">
        <div class="task-heading">
          <span class="subject-tag ${subMeta.cls}"><b>${subMeta.icon}</b> ${subMeta.name}</span>
          <span class="state ${t.done ? 'state-done' : 'state-pending'}">${t.done ? '✅ 已完成' : '🔥 待学习'}</span>
          <span class="duration-pill">⏱ ${mins}分</span>
        </div>
        ${(allowEdit || allowDel) ? `<div class="task-actions">
          ${allowEdit ? `<button type="button" data-action="edit" data-key="${esc(t.key)}" aria-label="编辑任务">编辑</button>` : ''}
          ${allowDel ? `<button type="button" data-action="delete" data-key="${esc(t.key)}" aria-label="删除任务">删除</button>` : ''}
        </div>` : ''}
      </div>
      <h3>${esc(t.title)}</h3>
      ${t.description ? `<p>${esc(t.description)}</p>` : ''}
      <div class="meta">
        <span>📅 ${t.date}</span>
        ${t.reminderTime ? `<span>⏰ ${esc(t.reminderTime)}</span>` : ''}
        <span>↻ ${esc(repeatLabel(t.repeatRule))}</span>
        ${t.done && t.completedAt ? `<span class="done-time-tag">🎉 完成于 ${esc(new Date(t.completedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }))}</span>` : ''}
      </div>
    </div>
  </article>`;
}

function pausedHTML() {
  const tasks = Object.values(data.tasks).filter(t => !t.deleted && (!t.enabled || t.startDate > date) && (subject === 'all' || t.subjectId === subject));
  return tasks.length
    ? `<details class="plans"><summary>⏸ 暂停 / 未来计划（${tasks.length} 项）</summary><div class="plans-list">${tasks.map(t => `<p><span><strong>${esc(t.title)}</strong> · ${t.enabled ? t.startDate + ' 开始' : '已暂停'}</span> <button type="button" data-resume="${esc(t.id)}">管理计划</button></p>`).join('')}</div></details>`
    : '';
}

function show(content) {
  dialog.innerHTML = content;
  dialog.showModal();
  dialog.querySelector('[data-close]')?.addEventListener('click', () => dialog.close());
}

function edit(t) {
  if (t ? !canEditTask() : !canAddTask()) return;
  const initial = t || {
    subjectId: subject === 'all' ? 'chinese' : subject,
    title: '',
    description: '',
    startDate: date,
    endDate: '',
    durationMinutes: 20,
    reminderTime: '',
    enabled: true,
    repeatRule: { type: 'daily', days: [1, 3, 5], interval: 2 }
  };
  show(`<form id="task-form">
    <div class="modal-head">
      <h2>${t ? '✏️ 编辑学习计划' : '➕ 添加学习任务'}</h2>
      <button type="button" data-close aria-label="关闭">✕</button>
    </div>
    <label>任务名称
      <input name="title" required maxlength="100" value="${esc(initial.title)}" placeholder="例如：课外阅读 20 分钟">
    </label>
    <div class="form-row two-cols">
      <label>所属科目
        <select name="subjectId">${subjects.map(s => `<option value="${s.id}" ${s.id === initial.subjectId ? 'selected' : ''}>${s.name}</option>`).join('')}</select>
      </label>
      <label>预计时长（分钟）
        <input name="durationMinutes" type="number" min="5" max="240" step="5" value="${Number(initial.durationMinutes) || 20}">
      </label>
    </div>
    <label>学习内容与要求
      <textarea name="description" maxlength="2000" rows="3" placeholder="写下具体的学习目标或页码要求…">${esc(initial.description)}</textarea>
    </label>
    <div class="form-row two-cols">
      <label>重复方式
        <select id="repeat" name="repeat">${[
          ['once', '仅一次'],
          ['daily', '每天重复'],
          ['weekly', '每周（指定星期）'],
          ['interval', '每隔 N 天']
        ].map(([v, n]) => `<option value="${v}" ${v === initial.repeatRule.type ? 'selected' : ''}>${n}</option>`).join('')}</select>
      </label>
      <label>提醒时间（选填）
        <input name="reminderTime" type="time" value="${esc(initial.reminderTime || '')}">
      </label>
    </div>
    <div id="weekly" class="weekdays">
      ${[0, 1, 2, 3, 4, 5, 6].map(d => `<label><input type="checkbox" name="days" value="${d}" ${initial.repeatRule.days?.includes(d) ? 'checked' : ''}><span>${'日一二三四五六'[d]}</span></label>`).join('')}
    </div>
    <label id="interval">间隔天数
      <input name="interval" type="number" min="1" max="3650" value="${initial.repeatRule.interval || 2}">
    </label>
    <label class="inline"><input name="enabled" type="checkbox" ${initial.enabled ? 'checked' : ''}> 启用此学习计划</label>
    ${t ? '<label>修改范围<select name="scope"><option value="day">仅修改此执行日</option><option value="future">此执行日及以后的计划</option></select></label>' : ''}
    <button class="primary full">保存学习计划</button>
  </form>`);
  const update = () => {
    $('#weekly').hidden = $('#repeat').value !== 'weekly';
    $('#interval').hidden = $('#repeat').value !== 'interval';
  };
  $('#repeat').onchange = update;
  update();
  $('#task-form').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target),
          rule = {
            type: f.get('repeat'),
            days: f.getAll('days').map(Number),
            interval: Number(f.get('interval'))
          };
    if (rule.type === 'weekly' && !rule.days.length) return toast('请至少选择一个星期');
    if (rule.type === 'interval' && (!Number.isInteger(rule.interval) || rule.interval < 1)) return toast('请输入有效的间隔天数');
    const title = f.get('title').trim(),
          subId = f.get('subjectId'),
          scope = f.get('scope');
    saveTask(data, {
      title,
      description: f.get('description'),
      subjectId: subId,
      startDate: initial.startDate,
      endDate: initial.endDate || '',
      reminderTime: f.get('reminderTime') || '',
      durationMinutes: Number(f.get('durationMinutes')) || 20,
      repeatRule: rule,
      enabled: f.has('enabled')
    }, t, t?.date, scope);
    recordLog(
      t ? 'edit' : 'add',
      title,
      subId,
      t ? (scope === 'day' ? `仅修改 ${t.date} 当日` : `修改 ${t.date} 及后续计划`) : `起始日期：${initial.startDate}`
    );
    await persist();
    dialog.close();
  };
}

function remove(t) {
  if (!canDeleteTask()) return;
  show(`<form id="delete-form">
    <div class="modal-head">
      <h2>🗑️ 删除学习任务</h2>
      <button type="button" data-close>✕</button>
    </div>
    <p>确定删除「${esc(t.title)}」（${esc(t.date)}）？历史完成记录会保留。</p>
    <p class="hint">仅删除此执行日，会保留其他日期的同名待办；删除整个任务系列，才会移除该任务的全部卡片。</p>
    <label>删除范围
      <select name="scope">
        <option value="day">仅删除此执行日</option>
        <option value="future">终止此执行日及后续计划</option>
        <option value="series">删除整个任务系列</option>
      </select>
    </label>
    <button class="danger full">确认删除</button>
  </form>`);
  $('#delete-form').onsubmit = async e => {
    e.preventDefault();
    const scope = new FormData(e.target).get('scope');
    const scopeLabels = {
      day: `仅删除 ${t.date} 当日`,
      future: `终止 ${t.date} 及后续计划`,
      series: '删除整个任务系列'
    };
    deleteTask(data, t.id, t.date, scope);
    recordLog('delete', t.title, t.subjectId, scopeLabels[scope] || '');
    await persist();
    dialog.close();
    render();
    if (!storageFailed) toast(scope === 'series' ? '该任务系列已删除' : `${t.date} 的任务已删除，其他日期按所选范围保留`);
  };
}

function settingsHTML() {
  const pins = data.pins || defaultPins();
  return `<section class="settings single-stage-drawer ${drawerCascadeAnim ? 'ios-drawer-cascade' : ''}">
    <div class="settings-hero">
      <div>
        <span class="hero-pill">⚙ 系统控制室 · 父母专属</span>
        <h1>设置与云端数据同步</h1>
        <p class="hero-sub">管理家庭成员登录密码、GitHub 私有仓库实时同步及本机安全备份。</p>
      </div>
      <div class="settings-status-badge">
        <span class="sync-dot ${status.includes('失败') ? 'err' : status.includes('已同步') ? 'ok' : ''}"></span>
        <strong>${esc(status)}</strong>
      </div>
    </div>

    <form id="pin-form" class="panel settings-panel">
      <div class="pin-panel-head">
        <div>
          <h2>🔑 家庭账号与登录密码管理</h2>
          <p class="hint">直接在此修改各角色登录密码，保存后自动加密同步至所有家庭设备。</p>
        </div>
        <button type="button" id="toggle-pin-view" class="pin-eye-btn">👁 显示密码</button>
      </div>
      ${pins.updatedAt ? `<p class="perm-meta" style="display:inline-block;margin:0 0 12px">最近由 ${esc(pins.updatedBy)} 修改于 ${esc(new Date(pins.updatedAt).toLocaleString('zh-CN'))}</p>` : ''}
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
      <div class="buttons" style="margin-top:16px">
        <button type="submit" class="primary">保存并同步新密码</button>
      </div>
    </form>

    <form id="config" class="panel settings-panel">
      <h2>☁ 连接 GitHub 私有云仓库</h2>
      <p class="hint">连接诊断版 12（支持在线改密 + 动态权限 + 审计日志 + MQTT 秒级推送）</p>
      <p role="status" class="sync-status-line">当前状态：<strong>${esc(status)}</strong></p>
      <label>GitHub 个人访问令牌 (Fine-grained Token)
        <input name="token" type="password" required autocomplete="off" value="${esc(config.token || '')}" placeholder="github_pat_...">
      </label>
      <div class="buttons" style="margin:10px 0">
        <button type="button" id="load-repos">读取私有仓库</button>
      </div>
      <p id="repo-message" class="hint" role="status"></p>
      <label id="repo-label" ${config.owner && config.repo ? '' : 'hidden'}>数据仓库
        <select name="repository" id="repository">
          ${config.owner && config.repo ? `<option value="${esc(config.owner + '/' + config.repo)}">${esc(config.owner + '/' + config.repo)}</option>` : '<option value="">请先读取仓库</option>'}
        </select>
      </label>
      <p class="hint">仅需授权指定私有数据仓库的 Contents 读写权限。Token 仅保存在本设备本地，不进入云端同步与 JSON 备份文件。</p>
      <div class="buttons">
        <button class="primary">保存并测试连接</button>
        <button type="button" id="clear-token" class="danger">清除本机 Token</button>
      </div>
    </form>

    <section class="panel settings-panel">
      <h2>💾 本机备份与恢复</h2>
      <p>定期导出一份 JSON 学习数据，换设备或断网归档都安心。</p>
      <div class="buttons">
        <button type="button" id="export" class="primary">导出 JSON 备份</button>
        <label class="file-button">导入备份<input id="import" type="file" accept="application/json,.json" hidden></label>
        <button type="button" id="history">查看历史完成记录</button>
      </div>
      <p class="hint">恢复备份会按记录三方合并，安全保留历史完成状态。</p>
    </section>
  </section>`;
}

function bindSettings() {
  const pinForm = $('#pin-form'), toggleBtn = $('#toggle-pin-view');
  if (toggleBtn && pinForm) {
    let showPlain = false;
    toggleBtn.onclick = () => {
      showPlain = !showPlain;
      pinForm.querySelectorAll('.pin-input').forEach(inp => (inp.type = showPlain ? 'text' : 'password'));
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
      if (currentUser) {
        safeSetStorage('lyc_study_auth_user', JSON.stringify({
          username: currentUser.username,
          pin: data.pins[currentUser.username]
        }));
      }
      recordLog('edit', `修改了【${changed.join('、')}】的登录密码`, 'all', '安全设置变更');
      toast('新密码已保存，正在同步至所有设备…');
      await persist();
    };
  }

  const form = $('#config'),
        tokenInput = form.elements.token,
        select = $('#repository'),
        message = $('#repo-message'),
        loadButton = $('#load-repos');
  let generation = 0;
  const directButton = document.createElement('button');
  directButton.type = 'button';
  directButton.textContent = '直接验证 online 仓库';
  loadButton.after(directButton);
  directButton.onclick = async () => {
    const token = tokenInput.value.trim(), version = ++generation;
    if (!token) { message.textContent = '请先粘贴令牌。'; return; }
    loadButton.disabled = false;
    message.textContent = '正在验证 xfdliujin-netizen/online…';
    try {
      await client({ owner: 'xfdliujin-netizen', repo: 'online', token }).test();
      if (version !== generation || !form.isConnected) return;
      select.innerHTML = '<option value="xfdliujin-netizen/online">xfdliujin-netizen/online</option>';
      $('#repo-label').hidden = false;
      message.textContent = '仓库可访问，点击保存并测试连接以开始同步。';
    } catch (e) {
      if (version === generation) {
        message.textContent = e.status === 404
          ? '当前令牌无法访问 online（404）。请确认已点击 Update 保存授权，且填写的是这枚令牌。'
          : e.message;
      }
    }
  };
  tokenInput.oninput = () => {
    generation++;
    select.innerHTML = '<option value="">请先读取仓库</option>';
    $('#repo-label').hidden = true;
    message.textContent = '';
    loadButton.disabled = false;
  };
  loadButton.onclick = async () => {
    const token = tokenInput.value.trim(), version = ++generation;
    if (!token) { message.textContent = '请先粘贴令牌。'; return; }
    loadButton.disabled = true;
    message.textContent = '正在读取私有仓库…';
    try {
      const repos = await privateRepositories(token);
      if (version !== generation || !form.isConnected) return;
      select.innerHTML = (repos.length === 1 ? '' : '<option value="">请选择数据仓库</option>') +
        repos.map(r => '<option value="' + esc(r.owner + '/' + r.repo) + '">' + esc(r.owner + '/' + r.repo) + '</option>').join('');
      $('#repo-label').hidden = !repos.length;
      message.textContent = !repos.length
        ? '未找到可用私有仓库。请先在 GitHub 创建私有仓库，并给令牌授权该仓库的 Contents 读写权限。'
        : repos.length === 1
          ? '已自动选中，点击下方保存即可。'
          : '请选择用于存放学习记录的仓库。';
    } catch (e) {
      if (version === generation) message.textContent = e.message;
    } finally {
      if (version === generation) loadButton.disabled = false;
    }
  };
  $('#config').onsubmit = async e => {
    e.preventDefault();
    const fields = new FormData(e.target), repository = fields.get('repository');
    if (!repository) return toast('请先读取并选择私有仓库');
    const [owner, repo] = repository.split('/'),
          next = { owner, repo, token: fields.get('token').trim() };
    try {
      await client(next).test();
      config = next;
      await write('config', config);
      base = (await read('base:' + config.owner + '/' + config.repo)) || emptyData();
      setupRealtimePush();
      toast('连接成功');
      await sync();
    } catch (e) {
      message.textContent = e.message;
      toast(e.message);
    }
  };
  $('#clear-token').onclick = async () => {
    config.token = '';
    await write('config', config);
    status = '本地模式';
    render();
    toast('本设备 Token 已清除');
  };
  $('#export').onclick = () => {
    const a = document.createElement('a'),
          url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.href = url;
    a.download = `study-planner-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  $('#import').onchange = async e => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;
      const incoming = validate(JSON.parse(await file.text()));
      data = merge(emptyData(), data, incoming, choose);
      await persist();
      toast('备份已安全合并恢复');
    } catch (err) {
      toast(err.message);
    }
  };
  $('#history').onclick = () => {
    const records = Object.values(data.completions).filter(r => r.status).sort((a, b) => b.occurrenceDate.localeCompare(a.occurrenceDate));
    show(`<div class="modal-head"><h2>🏆 学习完成记录</h2><button type="button" data-close>✕</button></div><div class="history-modal-list">${records.map(r => `<p><span>📅 ${esc(r.occurrenceDate)}</span> <strong>${esc(data.tasks[r.taskId]?.title || '历史任务')}</strong> <b>✓</b></p>`).join('') || '<p>完成第一个任务后，记录会出现在这里。</p>'}</div>`);
  };
}

function choose(group, id, l, r) {
  return (l.updatedAt || '') >= (r.updatedAt || '') ? l : r;
}

function isEditing() {
  return !currentUser || screen === 'settings' || dialog.open || document.activeElement?.matches('input,textarea,select,[contenteditable="true"]');
}

let lastAutoSync = 0;

function updateSyncStatus() {
  const button = $('#sync');
  if (button) button.innerHTML = `<span class="sync-dot ${status.includes('失败') ? 'err' : status.includes('已同步') ? 'ok' : ''}"></span><span>☁ ${esc(status)}</span>`;
}

// ================= 实时推送同步模块 (MQTT over WebSocket) =================
const myDeviceId = 'dev_' + Math.random().toString(36).slice(2, 10);
let mqttClient = null, currentTopic = '', pendingRemotePull = false;

function getSyncTopic() {
  const repoPath = (config.owner && config.repo) ? `${config.owner}_${config.repo}` : 'xfdliujin-netizen_online';
  return `lyc_study_planner_sync_2026/${repoPath}`;
}

let mqttLoading = false;
function ensureMqttLoaded(cb) {
  if (window.mqtt) { cb(); return; }
  if (mqttLoading || !navigator.onLine) return;
  mqttLoading = true;
  const sc = document.createElement('script');
  sc.async = true;
  sc.src = 'https://cdn.jsdelivr.net/npm/mqtt@5.10.3/dist/mqtt.min.js';
  sc.onload = () => { mqttLoading = false; if (window.mqtt) cb(); };
  sc.onerror = () => { mqttLoading = false; };
  document.head.appendChild(sc);
}

function setupRealtimePush() {
  if (!window.mqtt) { ensureMqttLoaded(setupRealtimePush); return; }
  const topic = getSyncTopic();
  if (mqttClient) {
    if (currentTopic && currentTopic !== topic) {
      mqttClient.unsubscribe(currentTopic);
      mqttClient.subscribe(topic);
      currentTopic = topic;
    }
    return;
  }
  currentTopic = topic;
  mqttClient = window.mqtt.connect('wss://broker.emqx.io:8084/mqtt', { keepalive: 60, reconnectPeriod: 5000 });
  mqttClient.on('connect', () => {
    if (currentTopic) mqttClient.subscribe(currentTopic);
  });
  mqttClient.on('message', (t, message) => {
    if (t !== currentTopic) return;
    try {
      const payload = JSON.parse(message.toString());
      if (payload.sender !== myDeviceId) {
        lastAutoSync = 0;
        if (isEditing() || busy) {
          pendingRemotePull = true;
        } else {
          autoSync(true);
        }
      }
    } catch (e) {}
  });
}

function notifyOtherDevices() {
  if (mqttClient && mqttClient.connected && currentTopic) {
    mqttClient.publish(currentTopic, JSON.stringify({ sender: myDeviceId, time: Date.now() }));
  }
}

async function autoSync(force = false) {
  if (document.hidden || isEditing() || busy || !navigator.onLine || !config.token || storageFailed || (!force && Date.now() - lastAutoSync < 60000)) return;
  lastAutoSync = Date.now();
  await sync({ quiet: true });
}

async function sync(options = {}) {
  const quiet = options.quiet === true;
  if (busy || !config.token || storageFailed) return;
  if (!navigator.onLine) {
    status = '等待同步（离线）';
    if (!quiet && !isEditing()) render();
    return;
  }
  busy = true;
  status = '同步中';
  updateSyncStatus();
  try {
    const api = client(config);
    let synced = false, pushed = false;
    for (let n = 0; n < 3; n++) {
      const remote = await api.pull();
      if (quiet && isEditing()) {
        status = '编辑中，稍后继续同步';
        return;
      }
      const snapshot = structuredClone(data),
            merged = merge(base, snapshot, remote.data, choose);
      if (JSON.stringify(merged) !== JSON.stringify(remote.data)) {
        try {
          await api.push(merged, remote.sha);
          pushed = true;
        } catch (e) {
          if (e.status === 409) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (n + 1)));
            continue;
          }
          throw e;
        }
      }
      data = merge(snapshot, data, merged, choose);
      base = merged;
      await write('data', data);
      await write('base:' + config.owner + '/' + config.repo, base);
      synced = true;
      break;
    }
    if (!synced) throw Error('多设备正在修改，请稍后重试');
    status = '已同步';
    if (pushed) notifyOtherDevices();
  } catch (e) {
    status = '同步失败：' + e.message;
    if (!quiet) toast(e.message);
  } finally {
    busy = false;
    if (!isEditing()) render();
    if (pendingRemotePull && !isEditing()) {
      pendingRemotePull = false;
      autoSync(true);
    }
  }
}

(async function bootApp() {
  try {
    // 立即先渲染一次默认界面，确保页面零延迟秒开不白屏
    if (!safeGetStorage('lyc_study_auth_user')) {
      safeSetStorage('lyc_study_auth_user', JSON.stringify({ username: 'baba', pin: getAccountPin('baba') }));
    }
    verifySavedSession();
    render();

    await openDB();
    const savedData = await read('data');
    if (savedData) data = validate(savedData);
    config = (await read('config')) || {};
    base = (await read('base:' + config.owner + '/' + config.repo)) || emptyData();
    verifySavedSession();
    if (Object.keys(data.tasks || {}).length === 0 && !safeGetStorage('lyc_study_seeded_v1')) {
      await seedStarterTasks(true);
    } else {
      render();
    }
    setupRealtimePush();
    sync();
  } catch (e) {
    render();
  }
})();

window.addEventListener('online', () => {
  lastAutoSync = 0;
  autoSync(true);
});
window.addEventListener('offline', () => {
  status = '等待同步（离线）';
  if (!isEditing()) render();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) autoSync(false);
});
dialog.addEventListener('close', () => {
  if (pendingRemotePull) {
    pendingRemotePull = false;
    autoSync(true);
  }
});
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
