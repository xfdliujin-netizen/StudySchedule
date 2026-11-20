export const subjects = [{id:'chinese',name:'语文',icon:'📖',color:'#fff0dc'},{id:'math',name:'数学',icon:'🧮',color:'#e7e5ff'},{id:'english',name:'英语',icon:'🔤',color:'#dff4ef'}];
export function today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export const dayNumber=d=>Date.parse(d+'T00:00:00Z')/86400000;
export const shiftDate=(d,n)=>new Date((dayNumber(d)+n)*86400000).toISOString().slice(0,10);
export function occurs(t,date){if(t.deleted||!t.enabled||date<t.startDate||(t.endDate&&date>t.endDate))return false;const r=t.repeatRule;return r.type==='daily'||(r.type==='once'&&date===t.startDate)||(r.type==='weekly'&&r.days.includes(new Date(date+'T00:00:00Z').getUTCDay()))||(r.type==='interval'&&(dayNumber(date)-dayNumber(t.startDate))%r.interval===0);}
export const key=(id,date)=>`${id}@${date}`;
export function instances(data, date, overdue = true, includeCompletedOn = null) {
  const rows = [];
  for (const task of Object.values(data.tasks)) {
    if (task.deleted || !task.enabled) continue;
    const start = overdue ? task.startDate : date;
    for (let scheduled = start; scheduled <= date; scheduled = shiftDate(scheduled, 1)) {
      const taskKey = key(task.id, scheduled);
      const exception = data.exceptions[taskKey];
      const withinPlan = scheduled >= task.startDate && (!task.endDate || scheduled <= task.endDate);
      if (exception?.deleted || !(occurs(task, scheduled) || (exception?.override && withinPlan))) continue;
      const completion = data.completions[taskKey];
      let completedOn = null;
      if (includeCompletedOn && completion?.completedAt) {
        const time = new Date(completion.completedAt);
        if (Number.isFinite(time.getTime())) {
          completedOn = `${time.getFullYear()}-${String(time.getMonth() + 1).padStart(2, '0')}-${String(time.getDate()).padStart(2, '0')}`;
        }
      }
      if (scheduled !== date && completion?.status && (!includeCompletedOn || completedOn !== includeCompletedOn)) continue;
      rows.push({
        ...task, ...exception?.override, id: task.id, date: scheduled, key: taskKey,
        done: Boolean(completion?.status), completedAt: completion?.completedAt
      });
    }
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || (a.reminderTime || '').localeCompare(b.reminderTime || ''));
}
export function repeatLabel(r){return {once:'仅一次',daily:'每天',weekly:'每周 '+(r.days||[]).map(d=>'日一二三四五六'[d]).join('、'),interval:`每隔 ${r.interval} 天`}[r.type];}
