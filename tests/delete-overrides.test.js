import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyData} from '../js/database.js';
import {saveTask,deleteTask} from '../js/task-manager.js';
import {instances} from '../js/repeat-engine.js';
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
