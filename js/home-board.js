import {subjects} from './repeat-engine.js';
import {learningView, relativeDay} from './view-model.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[c]));

const SUBJECT_COVER_ART = {
 chinese: '<svg viewBox="0 0 64 72" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="12" y="10" width="39" height="53" rx="4"/><path d="M20 10v53M27 23h16M27 30h16M27 37h12M26 53h18"/><path d="M47 6h8v51"/></svg>',
 math: '<svg viewBox="0 0 64 72" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 56L38 13l16 43Z"/><circle cx="35" cy="37" r="19"/><path d="M11 63h43M16 59v4M24 59v4M32 59v4M40 59v4M48 59v4"/></svg>',
 english: '<svg viewBox="0 0 64 72" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="7" y="13" width="49" height="38" rx="9"/><path d="M19 51l-3 10 16-10M16 40l7-17 7 17M19 34h8M37 30c11-9 17 14 0 9v-9Z"/></svg>'
};

const SUBJECT_META = {
  chinese: { badge: '文', tag: '诗书积累', color: '#d97706' },
  math:    { badge: 'π',  tag: '逻辑思维', color: '#7c3aed' },
  english: { badge: 'Aa', tag: '世界对话', color: '#059669' }
};

export function homeBoard(data, date, renderCard, filter = 'all') {
  return `<section class="home-board column-board" aria-label="各科学习进度">
    <div class="board-heading"><h2>三科学习进度</h2><span class="board-date-pill">${esc(relativeDay(date))} · 完成进度</span></div>
    <div class="subject-columns">${subjects.map(s => {
      const v = learningView(data, s.id, date), meta = SUBJECT_META[s.id];
      const rows = v.rows.filter(t => filter === 'all' || (filter === 'done' ? t.done : !t.done));
      return `<section class="subject-column board-${s.id}" aria-label="${s.name}任务">
        <button type="button" class="subject-column-overview" data-sub="${s.id}" aria-label="进入${s.name}学习计划">
          <span class="subject-cover-art" aria-hidden="true">${SUBJECT_COVER_ART[s.id]}</span><span class="column-label"><strong>${s.name}</strong><span class="subject-ring" style="--progress:${v.percent}%" role="progressbar" aria-label="${s.name}完成进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${v.percent}"><span>${v.percent}%</span></span></span>
          <span class="compact-count"><b>${v.done}</b>/${v.total} 完成 · <b>${v.pending}</b> 待学</span>
        </button>
        ${renderCard ? `<div class="column-task-list">${rows.map((t,i)=>renderCard(t,i)).join('') || '<p class="column-empty">'+(v.total ? '此筛选下暂无任务' : '还没有安排任务')+'</p>'}</div>` : ''}
      </section>`;
    }).join('')}</div>
  </section>`;
}
