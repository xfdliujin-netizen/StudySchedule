import {key,shiftDate} from './repeat-engine.js';
export const stamp=()=>({rev:crypto.randomUUID(),updatedAt:new Date().toISOString()});
export function saveTask(data,values,original,date,scope='future') {const now=new Date().toISOString();if(!original){const id=crypto.randomUUID();data.tasks[id]={...values,id,createdAt:now,...stamp()};return;}
 if(scope==='day'){data.exceptions[key(original.id,date)]={override:values,...stamp()};return;}
 const prior=data.tasks[original.id];if(date>prior.startDate){data.tasks[prior.id]={...prior,endDate:shiftDate(date,-1),...stamp()};const id=crypto.randomUUID();data.tasks[id]={...values,id,startDate:values.startDate<date?date:values.startDate,createdAt:now,...stamp()};}else data.tasks[prior.id]={...prior,...values,...stamp()};
}
export function deleteTask(data,id,date,scope){const t=data.tasks[id];if(scope==='day')data.exceptions[key(id,date)]={deleted:true,...stamp()};else if(scope==='future')data.tasks[id]={...t,endDate:shiftDate(date,-1),...stamp()};else data.tasks[id]={...t,deleted:true,...stamp()};}
export function complete(data,task){data.completions[task.key]={completionId:task.key,taskId:task.id,occurrenceDate:task.date,status:!task.done,completedAt:task.done?null:new Date().toISOString(),...stamp()};}
