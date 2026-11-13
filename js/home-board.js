import {subjects} from './repeat-engine.js';
import {learningView, relativeDay} from './view-model.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[c]));

const SUBJECT_META = {
  chinese: { badge: '文', tag: '诗书积累', color: '#d97706' },
  math:    { badge: 'π',  tag: '逻辑思维', color: '#7c3aed' },
  english: { badge: 'Aa', tag: '世界对话', color: '#059669' }
};

export function homeBoard(data, date, renderCard, filter = 'all') {
  return `<section class="home-board column-board" aria-label="各科学习进度">
    <div class="board-heading"><h2>三科学习进度</h2><span class="board-date-pill">${esc(relativeDay(date))} · 深色为已完成比例</span></div>
    <div class="subject-columns">${subjects.map(s => {
      const v = learningView(data, s.id, date), meta = SUBJECT_META[s.id];
      const rows = v.rows.filter(t => filter === 'all' || (filter === 'done' ? t.done : !t.done));
      return `<section class="subject-column board-${s.id}" aria-label="${s.name}任务">
        <button type="button" class="subject-column-overview" data-sub="${s.id}" aria-label="进入${s.name}学习计划">
          <span class="column-label"><b>${meta.badge}</b><strong>${s.name}</strong><span>↗</span></span>
          <span class="column-numbers"><strong>${v.percent}%</strong><small>${v.done}/${v.total} 项完成</small></span>
          <span class="column-chart" role="progressbar" aria-label="${s.name}完成进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${v.percent}">
            <span class="column-chart-fill" style="height:${v.percent}%"></span>
            <span class="column-chart-caption">${v.total ? (v.pending ? '待学习 '+v.pending+' 项' : '全部完成 ✓') : '暂无计划'}</span>
          </span>
        </button>
        ${renderCard ? `<div class="column-task-list">${rows.map((t,i)=>renderCard(t,i)).join('') || '<p class="column-empty">'+(v.total ? '此筛选下暂无任务' : '还没有安排任务')+'</p>'}</div>` : ''}
      </section>`;
    }).join('')}</div>
  </section>`;
}
