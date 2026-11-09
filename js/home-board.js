import {subjects} from './repeat-engine.js';
import {learningView,relativeDay} from './view-model.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function homeBoard(data,date){
 return `<section class="home-board" aria-label="各科学习进度"><div class="board-heading"><h2>${esc(relativeDay(date))}学习看板</h2><div class="board-actions"><span>点击科目查看任务</span><button id="board-settings" type="button" aria-label="打开设置">⚙ 设置</button></div></div>${subjects.map(s=>{
   const v=learningView(data,s.id,date),total=v.rows.length,done=v.rows.filter(t=>t.done).length,percent=total?Math.round(done/total*100):0;
   return `<button class="board-subject subject-summary board-${s.id}" data-sub="${s.id}" aria-label="进入${s.name}学习计划"><span class="subject-card-fill" style="width:${percent}%" aria-hidden="true"></span><span class="summary-top"><strong>${s.name}</strong><span class="summary-percent" role="progressbar" aria-label="${s.name}完成进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}">${percent}%</span></span><span class="summary-count"><strong>${done}</strong> / ${total} 项完成<span>${total?`待学习 ${total-done} 项`:'暂无计划'}</span></span><span class="summary-bottom"><span class="board-icon">${s.icon}</span><span>学习计划</span><span class="board-arrow" aria-hidden="true">↗</span></span></button>`;
 }).join('')}</section>`;
}
