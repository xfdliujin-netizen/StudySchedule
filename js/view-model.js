import {instances,shiftDate,today} from './repeat-engine.js';

export function learningView(data,subject,date,now=today()) {
  const inSubject=t=>subject==='all'||t.subjectId===subject;
  const rows=instances(data,date,date===now).filter(inSubject);
  const scheduled=instances(data,date,false).filter(inSubject);
  const done=scheduled.filter(t=>t.done).length;
  return {rows,done,pending:rows.filter(t=>!t.done).length,total:scheduled.length,
    percent:scheduled.length?Math.round(done/scheduled.length*100):0};
}
export function nearbyDays(data,now=today()) {
  return [-2,-1,0,1,2].map((offset,i)=>{
    const date=shiftDate(now,offset);
    return {date,label:['前天','昨天','今天','明天','后天'][i],count:instances(data,date,false).length};
  });
}
export function relativeDay(date,now=today()) {
  const offset=Math.round((Date.parse(date)-Date.parse(now))/86400000);
  return ({'-2':'前天','-1':'昨天','0':'今日','1':'明天','2':'后天'})[offset]||date;
}
