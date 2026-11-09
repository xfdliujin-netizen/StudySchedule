import {subjects} from './repeat-engine.js';
import {learningView,relativeDay} from './view-model.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function homeBoard(data,date){
 return `<section class="home-board" aria-label="各科学习进度"><div class="board-heading"><h2>${esc(relativeDay(date))}学习看板</h2><span>点击科目查看任务</span></div>${subjects.map(s=>{
   const v=learningView(data,s.id,date),total=v.rows.length,done=v.rows.filter(t=>t.done).length,percent=total?Math.round(done/total*100):0;
   return `<section class="board-subject board-${s.id}"><div class="board-subject-heading"><button data-sub="${s.id}"><span class="board-icon">${s.icon}</span><h3>${s.name}</h3><span class="board-arrow">→</span></button><span>${done} / ${total} 项完成</span></div><div class="board-progress-row"><div class="board-progress" role="progressbar" aria-label="${s.name}完成进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><i style="width:${percent}%"></i></div><strong>${percent}%</strong></div><div class="board-task-grid">${v.rows.map(t=>`<button class="board-task ${t.done?'is-done':''}" data-sub="${s.id}"><span class="board-task-fill" style="width:${t.done?100:0}%"></span><span class="board-task-name">${esc(t.title)}</span><span class="board-task-bottom"><span>${t.done?'✓ 已完成':'○ 待学习'}</span><span class="board-task-link" aria-hidden="true">↗</span></span></button>`).join('')||`<button class="board-no-task" data-sub="${s.id}">暂无计划 <span>进入${s.name}安排 →</span></button>`}</div></section>`;
 }).join('')}</section>`;
}
