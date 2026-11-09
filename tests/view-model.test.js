import {test} from 'node:test';
import assert from 'node:assert/strict';
import {learningView,nearbyDays,relativeDay} from '../js/view-model.js';
import {emptyData} from '../js/database.js';
test('subject counters exclude other subjects and use selected day',()=>{
 const d=emptyData();
 for(const [id,subjectId] of [['a','chinese'],['b','math'],['c','english']]) d.tasks[id]={id,subjectId,title:id,startDate:'2026-11-09',enabled:true,repeatRule:{type:'daily'}};
 d.completions['b@2026-11-09']={status:true};
 assert.equal(learningView(d,'chinese','2026-11-09','2026-11-09').done,0);
 assert.equal(learningView(d,'chinese','2026-11-09','2026-11-09').pending,1);
 assert.equal(learningView(d,'math','2026-11-09','2026-11-09').percent,100);
 assert.equal(learningView(d,'all','2026-11-09','2026-11-09').pending,2);
 const tomorrow=learningView(d,'math','2026-11-10','2026-11-09');
 assert.equal(tomorrow.done,0);assert.equal(tomorrow.pending,1);
 assert.equal(learningView(d,'chinese','2026-11-10','2026-11-09').rows.length,1);
});
test('five day shortcuts cross month boundaries and use correct labels',()=>{
 const days=nearbyDays(emptyData(),'2026-12-01');
 assert.deepEqual(days.map(d=>d.label),['前天','昨天','今天','明天','后天']);
 assert.equal(days[0].date,'2026-11-29');assert.equal(days[4].date,'2026-12-03');
 assert.equal(relativeDay('2026-12-02','2026-12-01'),'明天');
});
