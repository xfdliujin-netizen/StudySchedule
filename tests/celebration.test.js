import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allTodayDone} from '../js/celebration.js';
import {emptyData} from '../js/database.js';
test('celebration requires a nonempty day and all subjects complete on that day',()=>{
 const d=emptyData(),now='2026-11-09';
 assert.equal(allTodayDone(d,now),false);
 for(const id of ['chinese','math'])d.tasks[id]={id,subjectId:id,title:id,enabled:true,startDate:now,repeatRule:{type:'daily'}};
 d.completions['chinese@'+now]={status:true};assert.equal(allTodayDone(d,now),false);
 d.completions['math@'+now]={status:true};assert.equal(allTodayDone(d,now),true);
 d.tasks.math.startDate='2026-11-08';assert.equal(allTodayDone(d,now),true);
 d.completions['math@2026-11-08']={status:true};assert.equal(allTodayDone(d,now),true);
 d.completions['math@'+now].status=false;assert.equal(allTodayDone(d,now),false);
});
