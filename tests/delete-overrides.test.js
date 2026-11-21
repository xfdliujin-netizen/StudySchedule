import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyData} from '../js/database.js';
import {saveTask,deleteTask} from '../js/task-manager.js';
import {instances} from '../js/repeat-engine.js';
import {merge} from '../js/github-sync.js';

const day = '2026-11-21';
function repeatPlan() {
 const data = emptyData();
 data.tasks.t = {id:'t', title:'口算', subjectId:'math', enabled:true, startDate:'2026-11-20', repeatRule:{type:'daily'}, rev:'original'};
 return data;
}

test('a series or occurrence deleted in the cloud beats a concurrent offline edit', () => {
 const base = repeatPlan(), local = structuredClone(base), cloud = structuredClone(base);
 deleteTask(cloud, 't', day, 'series');
 saveTask(local, {...base.tasks.t, title:'较新的离线修改'}, base.tasks.t, base.tasks.t.startDate, 'future');
 const result = merge(base, local, cloud, (_group, _id, edited) => edited);
 assert.equal(result.tasks.t.deleted, true);
 assert.equal(instances(result, day, false).length, 0);
 const localDay = structuredClone(base), cloudDay = structuredClone(base);
 deleteTask(cloudDay, 't', day, 'day');
 saveTask(localDay, {...base.tasks.t, title:'离线单日修改'}, base.tasks.t, day, 'day');
 assert.equal(instances(merge(base, localDay, cloudDay, (_g, _id, item) => item), day, false).length, 0);
});

test('an offline split obeys the original plan’s deletion scope without deleting unrelated tasks', () => {
 const base = repeatPlan(), local = structuredClone(base);
 saveTask(local, {...base.tasks.t, title:'拆分后的口算'}, base.tasks.t, day, 'future');
 saveTask(local, {title:'独立新任务', subjectId:'math', enabled:true, startDate:day, repeatRule:{type:'daily'}});
 const split = Object.values(local.tasks).find(task => task.title === '拆分后的口算');
 assert.equal(split.splitFrom, 't');
 for (const scope of ['day', 'future', 'series']) {
  const cloud = structuredClone(base);
  deleteTask(cloud, 't', day, scope);
  const result = merge(base, local, cloud, (_g, _id, item) => item);
  assert.deepEqual(instances(result, day, false).map(row=>row.title), ['独立新任务']);
  assert.equal(instances(result, '2026-11-22', false).some(row=>row.id===split.id), scope === 'day');
 }
});
test('terminating a series hides later single-day overrides without removing earlier tasks',()=>{
 const d=emptyData();
 const t={id:'t',subjectId:'math',title:'数学',enabled:true,startDate:'2026-11-10',repeatRule:{type:'daily'},rev:'original'};
 d.tasks.t=t;
 saveTask(d,{...t,title:'修改后的数学'},t,'2026-11-13','day');
 assert.equal(instances(d,'2026-11-13',false).length,1);
 deleteTask(d,'t','2026-11-12','future');
 assert.equal(instances(d,'2026-11-13',false).length,0);
 assert.equal(instances(d,'2026-11-11',false).length,1);
 deleteTask(d,'t','2026-11-11','series');
 assert.equal(instances(d,'2026-11-13').length,0);
});
