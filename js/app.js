import {dailySubjectContent} from './daily-learning.js';
import {parseTaskSpeech} from './speech-task.js';
window.__STUDY_PLANNER_BOOTED__ = true;
import {allTodayDone, fireworks} from './celebration.js';
import {learningView, nearbyDays, relativeDay} from './view-model.js';
import {subjects, today, instances, repeatLabel, shiftDate} from './repeat-engine.js';
import {openDB, read, write, emptyData, validate, defaultKidPerms, defaultPins, normalizeLearningProfile} from './database.js';
import {saveTask, deleteTask, complete, stamp} from './task-manager.js';
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
    subject = 'chinese',
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
  const subObj = subjectList().find(s => s.id === subjectId);
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
  recordLog('add', '载入示例学习任务', 'all', '包含语文、数学、英语任务');
  safeSetStorage('lyc_study_seeded_v1', '1');
  if (!silent) toast('已载入 5 项语数英学习任务 🌟');
  await persist();
}

const dialog = $('#editor');
let activeVoiceRecognition = null;
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
const presetSubjectGroups = [
  ['各学段通用', [
    ['art', '艺术'], ['music', '音乐'], ['fine_arts', '美术'], ['physical_education', '体育与健康'],
    ['labor', '劳动'], ['practice', '综合实践活动'], ['local_curriculum', '地方课程'], ['school_curriculum', '校本课程']
  ]],
  ['小学与初中', [
    ['morality', '道德与法治'], ['science', '科学'], ['information_science', '信息科技']
  ]],
  ['初中与高中', [
    ['history', '历史'], ['geography', '地理'], ['physics', '物理'], ['chemistry', '化学'], ['biology', '生物学']
  ]],
  ['高中课程', [
    ['politics', '思想政治'], ['information_technology', '信息技术'], ['general_technology', '通用技术'],
    ['science_lab', '理科实验'], ['mental_health', '心理健康教育']
  ]],
  ['外语选项', [
    ['japanese', '日语'], ['russian', '俄语'], ['german', '德语'], ['french', '法语'], ['spanish', '西班牙语']
  ]]
];

function presetSubjects() {
  return [
    ...subjects.map(subject => ({ ...subject, group: '各学段通用', defaultVisible: true })),
    ...presetSubjectGroups.flatMap(([group, entries]) =>
      entries.map(([id, name]) => ({id, name, group, defaultVisible: false})))
  ];
}

function subjectList() {
  return [
    ...presetSubjects(),
    ...Object.values(data.customSubjects || {}).map(item => ({...item, group: '自定义', defaultVisible: true}))
  ];
}

function subjectVisible(item) {
  return data.subjectVisibility?.[item.id]?.visible ?? item.defaultVisible;
}

function visibleSubjects() {
  return subjectList().filter(subjectVisible);
}

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
  const bySub = Object.fromEntries(subjectList().map(item => [item.id, { ...item, total: 0, done: 0, minutes: 0 }]));
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
  const allLogs = Object.values(data.logs || {}).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  const filteredLogs = allLogs.filter(l => logFilter === 'all' || l.action === logFilter);


  const actionLabels = {
    add:    { text: '添加任务', cls: 'log-add',  icon: '➕' },
    edit:   { text: '编辑修改', cls: 'log-edit', icon: '✏️' },
    delete: { text: '删除任务', cls: 'log-del',  icon: '🗑️' }
  };

  return `<section class="reports-view single-stage-drawer ${drawerCascadeAnim ? 'ios-drawer-cascade' : ''}">
    <div class="reports-hero">
      <div class="reports-hero-main">

        <h1>学习${reportRange === 'week' ? '周报' : '月报'}</h1>
        <p class="reports-hero-sub">统计周期：${st.startDate} 至 ${st.endDate}（近 ${days} 天） · 累计专注约 <strong>${st.doneMinutes}</strong> 分钟</p>
        <div class="range-switch">
          <button type="button" data-range="week" class="${reportRange === 'week' ? 'selected' : ''}">📅 近 7 天周报</button>
          <button type="button" data-range="month" class="${reportRange === 'month' ? 'selected' : ''}">🗓️ 近 30 天月报</button>
        </div>
      </div>
    </div>

    <div class="report-kpis">
      <div class="kpi-card kpi-green">
        <div class="kpi-top"><span class="kpi-icon">✅</span><span class="kpi-tag">约 ${st.doneMinutes} 分钟</span></div>
        <strong>${st.done}<small> 项</small></strong>
        <span class="kpi-label">已打卡完成任务</span>
        <em>共安排 ${st.total} 项学习任务</em>
      </div>
      <div class="kpi-card kpi-warm">
        <div class="kpi-top"><span class="kpi-icon">⏳</span></div>
        <strong>${st.pending}<small> 项</small></strong>
        <span class="kpi-label">周期内待完成</span>
        
      </div>
      <div class="kpi-card kpi-purple">
        <div class="kpi-top"><span class="kpi-icon">🔥</span></div>
        <strong>${st.activeDays}<small> / ${days}天</small></strong>
        <span class="kpi-label">活跃学习天数</span>
      </div>
    </div>

    <div class="report-grid">
      <section class="panel report-panel">
        <div class="report-panel-head">
          <div>
            <h2>📚 各科完成数与学时</h2>
          </div>
        </div>
        <div class="sub-bars">
          ${Object.entries(st.bySub).filter(([, item]) => subjectVisible(item) || item.total > 0).map(([id, s]) => {
            const p = s.total ? Math.round((s.done / s.total) * 100) : 0;
            return `<div class="sub-bar-card sub-card-${id}">
              <div class="sub-bar-head">
                <span class="nav-icon icon-${id}">${esc(s.icon || "·")}</span>
                <div class="sub-bar-title">
                  <strong>${esc(s.name)}</strong>
                  <small>已完成 <b>${s.done}</b> / ${s.total} 项 · 累计专注 ${s.minutes} 分钟</small>
                </div>
                <div class="sub-bar-pct-wrap">
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
          </div>
        </div>
        <div class="daily-chart">
          ${chartDays.map(d => {
            const stateCls = d.total === 0 ? 'is-empty' : d.rate === 100 ? 'is-full' : d.done > 0 ? 'is-partial' : 'is-zero';
            return `<div class="chart-col ${d.isToday ? 'is-today' : ''}">
              <div class="chart-bar-wrap" title="${d.date}: 完成 ${d.done}/${d.total} 项">
                <div class="chart-bar ${stateCls}" style="height:${Math.max(d.total ? 12 : 6, d.rate)}%"></div>
              </div>
              <strong>${d.done}/${d.total}</strong>
              <small>${d.isToday ? '今天' : d.label}</small>
            </div>`;
          }).join('')}
        </div>
      </section>
    </div>

    <section class="panel audit-panel">
      <div class="audit-head">
        <div>
          <h2>任务操作记录</h2>
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

function dailyLearningHTML(content) {
  if (!content) return '';
  const english = content.ipa
    ? `<p><strong lang="en">${esc(content.text)}</strong> <span class="daily-ipa">/${esc(content.ipa)}/</span> · ${esc(content.meaning)}
        <button type="button" data-daily-speech="word">读单词</button></p>
      <p lang="en">${esc(content.example)} <button type="button" lang="zh-CN" data-daily-speech="example">读例句</button></p>`
    : `<p>${esc(content.text)}</p>`;
  return `<details class="ledger-daily"><summary>${esc(content.title)}</summary>${english}${content.notes.map(note => `<small>${esc(note)}</small>`).join('')}</details>`;
}

function speakDailyEnglish(text) {
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return toast('此浏览器不支持英语朗读');
  window.speechSynthesis.cancel();
  const speech = new window.SpeechSynthesisUtterance(text);
  speech.lang = 'en-US';
  speech.rate = 0.85;
  speech.onerror = event => {
    if (!['canceled', 'interrupted'].includes(event.error)) toast('无法播放，请检查系统的英语语音设置');
  };
  window.speechSynthesis.speak(speech);
}

const weatherIcons = {
  clear: ['☀️', '晴'], cloud: ['☁️', '多云'], fog: ['🌫️', '雾'],
  rain: ['🌧️', '雨'], snow: ['❄️', '雪'], storm: ['⛈️', '雷雨']
};
let weatherPending = false;
let weatherAutoDay = '';

function weatherKind(code) {
  if (code === 0) return 'clear';
  if ([1, 2, 3].includes(code)) return 'cloud';
  if ([45, 48].includes(code)) return 'fog';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if (code >= 95) return 'storm';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rain';
  return null;
}

function paintWeather(message = '') {
  const button = $('#planner-weather');
  if (!button) return;
  let cached;
  try { cached = JSON.parse(safeGetStorage('planner-weather')); } catch {}
  const condition = cached?.day === today() ? weatherIcons[cached.kind] : null;
  const label = message || (condition ? '今日天气：' + condition[1] + ' · Open-Meteo' : '点击启用本地天气 · 约略位置用于 Open-Meteo 查询');
  button.textContent = weatherPending ? '…' : (condition?.[0] || '🌡️');
  button.title = label;
  button.setAttribute('aria-label', label);
  button.disabled = weatherPending;
}

async function refreshWeather() {
  if (weatherPending) return;
  if (!navigator.geolocation) return toast('此浏览器无法定位，暂不能显示本地天气');
  weatherPending = true;
  paintWeather('正在获取本地天气');
  let message = '';
  try {
    const {coords} = await new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, {timeout: 10000, maximumAge: 3600000}));
    const query = new URLSearchParams({
      latitude: coords.latitude.toFixed(1), longitude: coords.longitude.toFixed(1),
      daily: 'weather_code', timezone: 'auto', forecast_days: '2'
    });
    const response = await fetch('https://api.open-meteo.com/v1/forecast?' + query, {signal: AbortSignal.timeout(10000)});
    if (!response.ok) throw Error('天气获取失败');
    const {daily} = await response.json();
    const day = today();
    const kind = weatherKind(daily?.weather_code?.[daily?.time?.indexOf(day)]);
    if (!kind) throw Error('缺少今日天气');
    safeSetStorage('planner-weather', JSON.stringify({day, kind}));
  } catch (error) {
    message = error?.code === 1 ? '定位未授权，无法显示本地天气' : '暂未获取到天气，可点击重试';
  } finally {
    weatherPending = false;
    paintWeather(message);
    if (message) toast(message);
  }
}

function bindWeather() {
  const button = $('#planner-weather');
  if (!button) return;
  paintWeather();
  button.onclick = refreshWeather;
  let cached;
  try { cached = JSON.parse(safeGetStorage('planner-weather')); } catch {}
  const day = today();
  if (cached?.day === day || weatherAutoDay === day || weatherPending) return;
  navigator.permissions?.query({name:'geolocation'}).then(result => {
    if (result.state !== 'granted' || !button.isConnected) return;
    weatherAutoDay = day;
    refreshWeather();
  }).catch(() => {});
}

function render() {
  verifySavedSession();
  if (!currentUser) {
    $('#app').className = 'theme-all';
    $('#app').innerHTML = loginHTML();
    bindLogin();
    return;
  }
  const allowAdd = canAddTask(),
        allowEdit = canEditTask(),
        allowDel = canDeleteTask(),
        allowRep = canViewReports();

  if (!allowRep && screen === 'reports') screen = 'tasks';

  const todayDate = today();
  const todayLabel = new Intl.DateTimeFormat('zh-CN', {weekday:'short'}).format(new Date(todayDate + 'T12:00:00'));
  const availableSubjects = visibleSubjects();
  const theme = availableSubjects.find(item => item.id === subject) || availableSubjects[0];
  if (theme) subject = theme.id;
  const dailyContent = dailySubjectContent(subject, todayDate, data.learningProfile);
  const view = learningView(data, subject, date);
  const rows = view.rows;
  const filteredRows = rows.filter(t => filter === 'all' || (filter === 'done' ? t.done : !t.done));
  $('#app').className = 'ledger-app';
  $('#app').innerHTML = `
    <aside class="planner-tabs" aria-label="学习导航">
      <nav aria-label="科目">
        ${availableSubjects.map(item => {
          const pending = learningView(data, item.id, date).pending;
          return `<button type="button" class="planner-subject-tab" data-sub="${esc(item.id)}" ${screen === 'tasks' && subject === item.id ? 'aria-current="page"' : ''}>
            <span>${esc(item.name)}</span><span class="subject-pending-number" aria-label="${pending} 项未完成">${pending}</span>
          </button>`;
        }).join('')}
      </nav>
      <nav class="planner-tabs-footer" aria-label="管理">
        ${allowRep ? `<button type="button" id="nav-reports" ${screen === 'reports' ? 'aria-current="page"' : ''}>看板</button>` : ''}
        <button type="button" id="settings" ${screen === 'settings' ? 'aria-current="page"' : ''}>设置</button>
      </nav>
    </aside>
    <main class="planner-content">
      ${screen === 'settings' ? settingsHTML() : screen === 'reports' ? reportsHTML() : !theme ? '<p class="ledger-empty no-subjects">请在设置中选择要显示的科目。</p>' : `
        <section class="subject-page" aria-label="${esc(theme.name)}学习任务">
          <div class="subject-page-heading">
            <h1>${esc(theme.name)}</h1>
            <div class="subject-heading-actions">
              <time datetime="${todayDate}">${todayDate.slice(5).replace('-', '/')} ${todayLabel}</time>
              <button type="button" id="planner-weather" aria-label="启用本地天气">🌡️</button>
              ${allowAdd ? '<button type="button" class="primary" id="add">添加任务</button>' : ''}
            </div>
          </div>
          <div class="subject-page-controls">
            <div class="subject-date-tabs" aria-label="快捷日期">
              ${nearbyDays(data).map(d => `<button type="button" data-date="${d.date}" aria-pressed="${date === d.date}">${d.label}</button>`).join('')}
              <label class="subject-date-picker">
                <span aria-hidden="true">▦ <span class="date-picker-value">${esc(date.slice(5).replace('-', '/'))}</span></span>
                <input type="date" id="date" value="${esc(date)}" aria-label="选择任务日期">
              </label>
            </div>
            <div class="subject-filters" aria-label="任务状态">
              ${[['all','全部',view.total],['pending','待学习',view.pending],['done','已学习',view.done]].map(([id,label,count]) =>
                `<button type="button" data-filter="${id}" aria-pressed="${filter === id}">${label} ${count}</button>`).join('')}
            </div>
          </div>
          ${dailyLearningHTML(dailyContent)}
          <div class="subject-entries workspace">
            ${filteredRows.map(cardHTML).join('') || '<p class="ledger-empty">暂无符合条件的任务</p>'}
            ${allowEdit ? pausedHTML() : ''}

          </div>
        </section>`}
    </main>
    <button type="button" id="voice-fab" aria-label="语音添加任务" title="语音添加任务"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11v1a7 7 0 0 0 14 0v-1M12 19v3m-3 0h6"/></svg></button>`;

  // 动画播放一次后复位标志，避免普通勾选时整栏重跳
  drawerCascadeAnim = false;

  bindWeather();
  document.querySelectorAll('[data-daily-speech]').forEach(button => {
    button.onclick = () => speakDailyEnglish(button.dataset.dailySpeech === 'word' ? dailyContent.text : dailyContent.example);
  });
  updateVoiceButton();
  $('#voice-fab').onclick = () => {
    if (activeVoiceRecognition) activeVoiceRecognition.stop();
    else startVoiceTask();
  };

  // 绑定事件
  document.querySelectorAll('[data-logout]').forEach(b => (b.onclick = logout));

  const switchSubject = newSub => {
    subject = newSub;
    screen = 'tasks';
    filter = 'all';
    render();
  };

  document.querySelectorAll('[data-sub]').forEach(b => {
    b.onclick = () => switchSubject(b.dataset.sub);
  });


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



  const openSettings = () => {
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
  if ($('#nav-reports')) $('#nav-reports').onclick = openReports;
  if ($('#sync')) $('#sync').onclick = sync;

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
            else if (!t.done) toast('任务已完成');
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

function cardHTML(t, idx = 0) {
  const allowEdit = canEditTask(), allowDel = canDeleteTask();
  const mins = Number(t.durationMinutes) || 20;
  return `<article class="task task-${esc(t.subjectId)} ${t.done ? 'completed' : ''}" style="--card-idx:${Math.min(idx, 8)}">
    <button type="button" class="check" data-action="complete" data-key="${esc(t.key)}" aria-label="${t.done ? '撤销完成' : '完成任务'}">
      <span>${t.done ? '✓' : ''}</span>
    </button>
    <div class="task-body">
      <div class="task-top-row">
        <h3>${esc(t.title)}</h3>
        ${(allowEdit || allowDel) ? `<div class="task-actions">
          ${allowEdit ? `<button type="button" data-action="edit" data-key="${esc(t.key)}" aria-label="编辑任务">编辑</button>` : ''}
          ${allowDel ? `<button type="button" data-action="delete" data-key="${esc(t.key)}" aria-label="删除任务">删除</button>` : ''}
        </div>` : ''}
      </div>
      ${t.description ? `<p>${esc(t.description)}</p>` : ''}
      <div class="meta">
        <span>${esc(t.date.slice(5).replace('-', '/'))}</span>
        <span>${mins} 分钟</span>
        ${t.reminderTime ? `<span>⏰ ${esc(t.reminderTime)}</span>` : ''}
        <span>${esc(repeatLabel(t.repeatRule))}</span>
        ${t.done && t.completedAt ? `<span class="done-time-tag">完成于 ${esc(new Date(t.completedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }))}</span>` : ''}
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
  const themeStyle = getComputedStyle($('#app'));
  for (const name of ['--accent', '--accent-2']) {
    dialog.style.setProperty(name, themeStyle.getPropertyValue(name).trim() || (name === '--accent' ? '#3b82f6' : '#6366f1'));
  }
  dialog.innerHTML = content;
  dialog.showModal();
  dialog.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
}

function startVoiceTask() {
  if (!canAddTask()) return toast('当前账号没有添加任务的权限');
  if (!visibleSubjects().length) return toast('请先在设置中显示要安排任务的科目');
  if (dialog.open || activeVoiceRecognition) return;
  const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Speech || !window.isSecureContext) {
    showVoiceTranscript('当前浏览器无法直接听写，可使用键盘听写。');
    return;
  }

  let recognition;
  let resultShown = false;
  const finish = () => {
    if (activeVoiceRecognition !== recognition) return;
    activeVoiceRecognition = null;
    updateVoiceButton();
  };
  const fallback = message => {
    if (activeVoiceRecognition !== recognition || resultShown) return;
    resultShown = true;
    finish();
    if (!dialog.open && canAddTask()) showVoiceTranscript(message);
  };
  try {
    recognition = new Speech();
    recognition.lang = 'zh-CN';
    recognition.onresult = event => {
      if (activeVoiceRecognition !== recognition || resultShown) return;
      resultShown = true;
      const transcript = event.results[event.resultIndex || 0][0].transcript;
      if (!dialog.open && canAddTask()) showVoiceTranscript('', transcript);
    };
    recognition.onerror = event => fallback(event.error === 'not-allowed'
      ? '麦克风未授权，可使用键盘听写。' : '听写未完成，可重试或使用键盘听写。');
    recognition.onend = () => {
      if (!resultShown) fallback('没有听到任务，可重试或使用键盘听写。');
      finish();
    };
    activeVoiceRecognition = recognition;
    recognition.start();
    updateVoiceButton();
  } catch {
    finish();
    showVoiceTranscript('无法启动麦克风，可使用键盘听写。');
  }
}

function updateVoiceButton() {
  const button = $('#voice-fab');
  if (!button) return;
  const label = activeVoiceRecognition ? '停止听写' : '语音添加任务';
  button.setAttribute('aria-label', label);
  button.setAttribute('aria-pressed', String(Boolean(activeVoiceRecognition)));
  button.title = label;
}

function showVoiceTranscript(message, transcript = '') {
  let draft;
  if (transcript) {
    try {
      const named = subjectList().filter(item => transcript.includes(item.name)).sort((a, b) => b.name.length - a.name.length)[0];
      draft = parseTaskSpeech(transcript, today(), subject);
      if (named) {
        draft.subjectId = named.id;
        draft.warnings = draft.warnings.filter(warning => !warning.startsWith('科目未明确'));
      }
      if (!visibleSubjects().some(item => item.id === draft.subjectId)) throw Error('请先在设置中显示这个科目。');
      if (draft.title.length > 100) throw Error('任务名称请控制在 100 字以内。');
    } catch (error) {
      message = error.message;
      draft = null;
    }
  }
  if (!draft) {
    show(`<form id="voice-transcript" class="voice-note">
      <div class="modal-head"><h2>一句话添加任务</h2><button type="button" data-close aria-label="关闭">×</button></div>
      <p class="hint">${esc(message)}</p>
      <label>任务内容<textarea name="transcript" rows="2" maxlength="500" required placeholder="例如：明天背十个英语单词">${esc(transcript)}</textarea></label>
      <div class="task-form-actions"><button type="button" id="voice-retry">重新听写</button><button type="submit" class="primary">查看任务</button></div>
    </form>`);
    $('#voice-retry').onclick = () => { dialog.close(); startVoiceTask(); };
    $('#voice-transcript').onsubmit = event => {
      event.preventDefault();
      const input = new FormData(event.currentTarget).get('transcript');
      dialog.close();
      showVoiceTranscript('', input);
    };
    return;
  }

  const subjectName = subjectList().find(item => item.id === draft.subjectId)?.name || '语文';
  const { warnings, description, ...task } = draft;
  show(`<form id="voice-confirm" class="voice-note">
    <div class="modal-head"><h2>确认学习任务</h2><button type="button" data-close aria-label="关闭">×</button></div>
    <p class="voice-task-title">${esc(task.title)}</p>
    <dl><div><dt>科目</dt><dd>${esc(subjectName)}</dd></div><div><dt>开始日期</dt><dd>${esc(task.startDate)}</dd></div>
    <div><dt>重复</dt><dd>${esc(repeatLabel(task.repeatRule))}</dd></div><div><dt>时长</dt><dd>${task.durationMinutes} 分钟</dd></div></dl>
    ${warnings.length ? `<p class="hint">${esc(warnings.join('。'))}</p>` : ''}
    <div class="task-form-actions"><button type="button" id="voice-redo">重新听写</button><button type="submit" class="primary">确认添加</button></div>
  </form>`);
  $('#voice-redo').onclick = () => { dialog.close(); startVoiceTask(); };
  const form = $('#voice-confirm');
  let added = false;
  form.onsubmit = async event => {
    event.preventDefault();
    if (!canAddTask()) return toast('当前账号没有添加任务的权限');
    if (!visibleSubjects().some(item => item.id === task.subjectId)) return toast('请先在设置中显示这个科目');
    const submit = form.querySelector('[type="submit"]');
    if (submit.disabled) return;
    submit.disabled = true;
    if (!added) {
      saveTask(data, { ...task, description: '', enabled: true, endDate: '', reminderTime: '' });
      recordLog('add', task.title, task.subjectId, '语音添加 · ' + task.startDate);
      added = true;
    }
    await persist();
    if (storageFailed) {
      submit.disabled = false;
      return;
    }
    screen = 'tasks';
    subject = task.subjectId;
    date = task.startDate;
    filter = 'all';
    dialog.close();
    render();
  };
}

function edit(t) {
  if (t ? !canEditTask() : !canAddTask()) return;
  if (!t && !visibleSubjects().length) return;
  const initial = t || {
    subjectId: visibleSubjects().some(item => item.id === subject) ? subject : visibleSubjects()[0]?.id,
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

    ${!t ? `<label>开始日期<input type="date" name="speechDate" value="${esc(initial.startDate)}" required></label>` : ''}
    <label>任务名称
      <input name="title" required maxlength="100" value="${esc(initial.title)}" placeholder="例如：课外阅读 20 分钟">
    </label>
    <div class="form-row two-cols">
      <label>所属科目
        <select name="subjectId">${subjectList().filter(s => subjectVisible(s) || s.id === initial.subjectId).map(s => `<option value="${s.id}" ${s.id === initial.subjectId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
      </label>
      <label>预计时长（分钟）
        <input name="durationMinutes" type="number" min="1" max="240" step="1" value="${Number(initial.durationMinutes) || 20}">
      </label>
    </div>
    <label>学习内容与要求
      <textarea name="description" maxlength="2000" rows="2" placeholder="写下具体的学习目标或页码要求…">${esc(initial.description)}</textarea>
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
    <div class="task-form-actions"><button type="button" data-close>取消</button><button type="submit" class="primary">${t ? '确认保存修改' : '确认添加任务'}</button></div>
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
      startDate: t ? initial.startDate : (f.get('speechDate') || initial.startDate),
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

function subjectGroupsHTML() {
  const groups = new Map();
  for (const item of subjectList()) {
    const group = groups.get(item.group) || [];
    group.push(item);
    groups.set(item.group, group);
  }
  return [...groups].map(([name, items]) => `<fieldset class="subject-options">
    <legend>${esc(name)}</legend>
    ${items.map(item => `<label><input type="checkbox" data-subject-visible="${esc(item.id)}" ${subjectVisible(item) ? 'checked' : ''}> ${esc(item.name)}</label>`).join('')}
  </fieldset>`).join('');
}

function settingsHTML() {
  const account = `<section class="panel settings-panel account-panel"><h2>账号</h2><p>当前账号：${esc(currentUser.name)}</p><button type="button" data-logout>切换账号</button></section>`;
  if (!isParent()) return `<section class="settings"><h1>设置</h1>${account}</section>`;
  const pins = data.pins || defaultPins();
  const profile = normalizeLearningProfile(data.learningProfile);
  const perms = data.kidPerms || defaultKidPerms();
  return `<section class="settings single-stage-drawer ${drawerCascadeAnim ? 'ios-drawer-cascade' : ''}">
    <div class="settings-hero">
      <div>

        <h1>设置与云端数据同步</h1>

      </div>
      <div class="settings-status-badge">
        <span class="sync-dot ${status.includes('失败') ? 'err' : status.includes('已同步') ? 'ok' : ''}"></span>
        <strong>${esc(status)}</strong>
      </div>
    </div>

    ${account}

    <form id="learning-profile-form" class="panel settings-panel">
      <h2>学习档案</h2>
      <div class="learning-profile-fields">
        <label>年级
          <select name="grade">
            <option value="0">未设置</option>
            ${Array.from({length:12}, (_, i) => i + 1).map(grade => `<option value="${grade}" ${profile.grade === grade ? 'selected' : ''}>${grade <= 6 ? '小学 ' + grade + ' 年级' : grade <= 9 ? '初中 ' + (grade - 6) + ' 年级' : '高中 ' + (grade - 9) + ' 年级'}</option>`).join('')}
          </select>
        </label>
        <label>地区<input name="region" maxlength="24" placeholder="例如：江苏苏州" value="${esc(profile.region)}"></label>
      </div>
      <p class="hint">用于选择每日诗文、公式和英语。地区填写省市即可。</p>
      <button type="submit" class="primary">保存学习档案</button>
    </form>

    <section class="panel settings-panel subject-management">
      <h2>科目管理</h2>
      <p class="hint">勾选要显示在左侧的科目。隐藏后，原有任务和记录仍会保留。</p>
      ${subjectGroupsHTML()}
      <form id="subject-form" class="custom-subject-form">
        <label>自定义科目<input name="subjectName" required maxlength="20" placeholder="输入科目名称"></label>
        <button type="submit" class="primary">添加并显示</button>
      </form>
    </section>
    <section class="panel perm-panel settings-panel">
      <div class="perm-header">
        <div>
          <h2>孩子账号权限</h2>
          <p>修改后通过现有同步设置更新到其他设备。</p>
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
          <div class="perm-card-text"><strong>允许查看统计周报</strong></div>
          <input type="checkbox" class="ios-switch" data-perm="canReport" ${perms.canReport ? 'checked' : ''}>
        </label>
      </div>
    </section>
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
        <button type="button" id="sync">立即同步</button>
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
  if (!isParent()) return;
  $('#learning-profile-form').onsubmit = async event => {
    event.preventDefault();
    if (!isParent()) return;
    const fields = new FormData(event.currentTarget);
    const grade = fields.get('grade'), region = fields.get('region');
    data.learningProfile = normalizeLearningProfile({grade, region, updatedAt: Date.now()});
    await persist();
    if (!storageFailed) toast('学习档案已保存');
  };
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
  document.querySelectorAll('[data-subject-visible]').forEach(input => {
    input.onchange = async () => {
      if (!isParent()) return;
      const id = input.dataset.subjectVisible;
      if (!subjectList().some(item => item.id === id)) return;
      (data.subjectVisibility ||= {})[id] = {visible: input.checked, ...stamp()};
      const position = $('.planner-content').scrollTop;
      await persist();
      if (screen === 'settings') $('.planner-content').scrollTop = position;
    };
  });
  $('#subject-form').onsubmit = async event => {
    event.preventDefault();
    const name = new FormData(event.currentTarget).get('subjectName').trim();
    if (!name || name.length > 20) return toast('请输入 1 到 20 字的科目名称');
    if (subjectList().some(item => item.name.toLowerCase() === name.toLowerCase())) return toast('该科目已存在');
    if (['首页', '看板', '设置'].includes(name)) return toast('请使用其他科目名称');
    const revision = stamp();
    const id = 'custom_' + revision.rev;
    (data.customSubjects ||= {})[id] = { id, name, ...revision };
    const position = $('.planner-content').scrollTop;
    await persist();
    if (screen === 'settings') $('.planner-content').scrollTop = position;
  };
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
      const nextBase = (await read('base:' + next.owner + '/' + next.repo)) || emptyData();
      if (busy) return toast('正在同步，请稍后再保存连接设置');
      config = next;
      base = nextBase;
      retrySyncAt = 0;
      syncFailures = 0;
      await write('config', config);
      setupRealtimePush();
      toast('连接成功');
      await sync();
    } catch (e) {
      message.textContent = e.message;
      toast(e.message);
    }
  };
  $('#clear-token').onclick = async () => {
    if (busy) return toast('正在同步，请稍后再清除连接');
    config = { ...config, token: '' };
    retrySyncAt = 0;
    syncFailures = 0;
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
  return !currentUser || dialog.open || document.activeElement?.matches('input,textarea,select,[contenteditable="true"]');
}

// Record order can differ across devices without changing the stored data.
function sameSyncData(left, right) {
  const canonical = (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]]))
    : value;
  return JSON.stringify(left, canonical) === JSON.stringify(right, canonical);
}

let lastAutoSync = 0, syncFailures = 0;

function updateSyncStatus() {
  for (const label of document.querySelectorAll('.settings-status-badge strong, .sync-status-line strong')) label.textContent = status;
  const button = $('#sync');
  if (button) button.innerHTML = `<span class="sync-dot ${status.includes('失败') ? 'err' : status.includes('已同步') ? 'ok' : ''}"></span><span>☁ ${esc(status)}</span>`;
}

// ================= 实时推送同步模块 (MQTT over WebSocket) =================
const myDeviceId = 'dev_' + Math.random().toString(36).slice(2, 10);
let mqttClient = null, currentTopic = '', pendingRemotePull = false;
let mqttLoading = false, pendingNotification = false, realtimeReady = false;
let retrySyncAt = 0, retryTimer, mqttRetryTimer;
function getSyncTopic() {
  return 'lyc_study_planner_sync_2026/' + ((config.owner && config.repo) ? config.owner+'_'+config.repo : 'xfdliujin-netizen_online');
}
function ensureMqttLoaded(cb) {
  if (window.mqtt) { cb(); return; }
  if (mqttLoading || !navigator.onLine) return;
  mqttLoading = true;
  const sc = document.createElement('script');
  sc.async = true;
  sc.src = 'https://cdn.jsdelivr.net/npm/mqtt@5.10.3/dist/mqtt.min.js';
  let finished=false;
  const finish=()=>{
    if(finished)return;finished=true;clearTimeout(timeout);mqttLoading=false;
    if(window.mqtt)cb();
    else {sc.remove();clearTimeout(mqttRetryTimer);mqttRetryTimer=setTimeout(()=>ensureMqttLoaded(cb),10000);}
  };
  const timeout=setTimeout(finish,15000);
  sc.onload=finish;sc.onerror=finish;document.head.appendChild(sc);
}
function subscribeRealtime() {
  if(!mqttClient?.connected)return;
  const topic=currentTopic;
  mqttClient.subscribe(topic,{qos:1},(error,granted)=>{
    if(topic!==currentTopic)return;
    realtimeReady=!error&&!!granted?.length&&granted.every(g=>g.qos<128);
    if(realtimeReady){
      if(pendingNotification)notifyOtherDevices();
      pendingRemotePull=true;autoSync(true);
    }
  });
}
function setupRealtimePush() {
  if(!config.token)return;
  if(!window.mqtt){ensureMqttLoaded(setupRealtimePush);return;}
  const topic=getSyncTopic();
  if(mqttClient){
    if(currentTopic!==topic){mqttClient.unsubscribe(currentTopic);currentTopic=topic;realtimeReady=false;subscribeRealtime();}
    return;
  }
  currentTopic=topic;
  mqttClient=window.mqtt.connect('wss://broker.emqx.io:8084/mqtt',{keepalive:30,reconnectPeriod:3000,connectTimeout:10000});
  mqttClient.on('connect',subscribeRealtime);
  for(const event of ['offline','close','error'])mqttClient.on(event,()=>{realtimeReady=false;});
  mqttClient.on('message',(topic,message)=>{
    if(topic!==currentTopic)return;
    try{
      const payload=JSON.parse(message.toString());
      if(payload.sender!==myDeviceId){pendingRemotePull=true;autoSync(true);}
    }catch{}
  });
}
function notifyOtherDevices() {
  pendingNotification=true;
  if(!mqttClient?.connected||!currentTopic)return;
  pendingNotification=false;
  mqttClient.publish(currentTopic,JSON.stringify({sender:myDeviceId,time:Date.now()}),{qos:1},error=>{
    if(error)pendingNotification=true;
  });
}
async function autoSync(force=false) {
  if(document.hidden||isEditing()||busy||!navigator.onLine||!config.token||storageFailed||Date.now()<retrySyncAt)return;
  if(!force&&!pendingRemotePull&&Date.now()-lastAutoSync<60000)return;
  lastAutoSync=Date.now();pendingRemotePull=false;
  await sync({quiet:true});
}

async function sync(options = {}) {
  const quiet = options.quiet === true;
  if (busy) { pendingRemotePull = true; return; }
  if (!config.token || storageFailed) return;
  if (Date.now() < retrySyncAt) { pendingRemotePull = true; return; }
  if (!navigator.onLine) {
    pendingRemotePull = true;
    status = '等待同步（离线）';
    updateSyncStatus();
    return;
  }
  pendingRemotePull = false;
  lastAutoSync = Date.now();
  busy = true;
  const beforePull = data;
  let changedLocally = false;
  status = '同步中';
  updateSyncStatus();
  try {
    // MQTT is an optional notification channel; GitHub reads and writes stand on their own.
    try { setupRealtimePush(); } catch { realtimeReady = false; }
    const api = client(config);
    let synced = false, pushed = false;
    for (let n = 0; n < 3; n++) {
      const remote = await api.pull();
      if (quiet && isEditing()) {
        pendingRemotePull = true;
        status = '编辑中，稍后继续同步';
        return;
      }
      const snapshot = structuredClone(data),
            merged = merge(base, snapshot, remote.data, choose);
      if (!sameSyncData(merged, remote.data)) {
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
      const incoming = merge(snapshot, data, merged, choose);
      if (!sameSyncData(data, incoming)) {
        data = incoming;
        changedLocally = true;
        await write('data', data);
      }
      if (!sameSyncData(base, merged)) {
        await write('base:' + config.owner + '/' + config.repo, merged);
        base = merged;
      }
      synced = true;
      break;
    }
    if (!synced) throw Error('多设备正在修改，请稍后重试');
    retrySyncAt = 0;
    syncFailures = 0;
    const waitingUpload = !sameSyncData(data, base);
    if (waitingUpload) pendingRemotePull = true;
    status = waitingUpload ? '等待上传最新修改' : pendingRemotePull ? '等待检查云端更新' : '已同步';
    if (pushed) {
      try { notifyOtherDevices(); } catch { pendingNotification = true; }
    }
  } catch (e) {
    pendingRemotePull = true;
    syncFailures++;
    const delay = Math.max(Math.min(120000, 10000 * 2 ** Math.min(syncFailures - 1, 4)), e.retryAfterMs || 0);
    retrySyncAt = Date.now() + delay;
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => autoSync(true), Math.min(2147483647, delay + 100));
    status = '同步失败，将自动重试：' + e.message;
    if (!quiet) toast(e.message);
  } finally {
    busy = false;
    if ((changedLocally || data !== beforePull) && screen !== 'settings' && !isEditing()) render();
    updateSyncStatus();
    if (pendingRemotePull && !isEditing() && Date.now() >= retrySyncAt) {
      clearTimeout(retryTimer);retryTimer=setTimeout(()=>autoSync(true),300);
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
    if (!config.token && Object.keys(data.tasks || {}).length === 0 && !safeGetStorage('lyc_study_seeded_v1')) {
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
  setupRealtimePush();pendingRemotePull=true;
  lastAutoSync = 0;
  autoSync(true);
});
window.addEventListener('offline', () => {
  status = '等待同步（离线）';
  if (!isEditing()) render();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) { setupRealtimePush();pendingRemotePull=true;autoSync(true); }
});
dialog.addEventListener('close',()=>{if(pendingRemotePull)autoSync(true);});
window.addEventListener('focus',()=>{setupRealtimePush();pendingRemotePull=true;autoSync(true);});
document.addEventListener('focusout',()=>{if(pendingRemotePull)setTimeout(()=>autoSync(true),0);});
// Push normally starts the pull. Check once a minute for missed notifications,
// or sooner when push is disconnected or a pending operation needs a retry.
setInterval(() => {
  try { setupRealtimePush(); } catch { realtimeReady = false; }
  if (pendingNotification && realtimeReady) {
    try { notifyOtherDevices(); } catch { pendingNotification = true; }
  }
  autoSync(pendingRemotePull || !realtimeReady);
}, 10000);
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
