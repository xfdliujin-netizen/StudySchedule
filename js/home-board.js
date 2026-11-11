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

export function homeBoard(data, date) {
  const dayLabel = esc(relativeDay(date));
  return `<section class="home-board" aria-label="各科学习进度">
    <div class="board-heading">
      <div class="board-heading-left">
        <h2>📚 三科概览</h2>
        <span class="board-sub-hint">点击切换单科抽屉</span>
      </div>
      <span class="board-date-pill">${dayLabel}学科进度</span>
    </div>
    <div class="home-subject-grid">
      ${subjects.map(s => {
        const v = learningView(data, s.id, date);
        const total = v.rows.length;
        const done = v.rows.filter(t => t.done).length;
        const pending = total - done;
        const percent = total ? Math.round((done / total) * 100) : 0;
        const meta = SUBJECT_META[s.id] || { badge: s.icon, tag: '学习计划' };
        return `<button type="button" class="board-subject subject-summary board-${s.id}" data-sub="${s.id}" aria-label="进入${s.name}学习计划">
          <span class="subject-card-fill" style="width:${percent}%" aria-hidden="true"></span>
          <div class="summary-top">
            <span class="summary-icon-wrap">
              <span class="board-icon">${meta.badge}</span>
              <span class="summary-title-group">
                <strong>${s.name}</strong>
                <small>${meta.tag}</small>
              </span>
            </span>
            <span class="summary-percent" role="progressbar" aria-label="${s.name}完成进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}">${percent}%</span>
          </div>
          <div class="summary-bottom">
            <span class="summary-count"><strong>${done}</strong>/${total} 项 <em class="${pending > 0 ? 'has-pending' : 'all-clear'}">${total ? (pending ? `待学 ${pending}` : '已全部完成') : '暂无任务'}</em></span>
            <span class="board-arrow" aria-hidden="true">›</span>
          </div>
        </button>`;
      }).join('')}
    </div>
  </section>`;
}
