import {test} from 'node:test';
import assert from 'node:assert/strict';
import {homeBoard} from '../js/home-board.js';
import {emptyData} from '../js/database.js';
test('home columns group tasks by subject and respect completion filter',()=>{
 const d=emptyData();
 for(const id of ['chinese','math'])d.tasks[id]={id,subjectId:id,title:id,enabled:true,startDate:'2026-11-13',repeatRule:{type:'daily'}};
 d.completions['chinese@2026-11-13']={status:true};
 const seen=[];
 const html=homeBoard(d,'2026-11-13',t=>{seen.push(t.id);return `<article>${t.id}</article>`;},'pending');
 assert.deepEqual(seen,['math']);
 assert.match(html,/height:100%/);assert.match(html,/height:0%/);
 assert.equal((html.match(/class="subject-column board-/g)||[]).length,3);
 assert.equal((html.match(/class="column-task-list"/g)||[]).length,3);
});
test('board reports each subject separately and hides individual tasks',()=>{
 const d=emptyData();for(const id of ['chinese','math'])d.tasks[id]={id,subjectId:id,title:'<test>',enabled:true,startDate:'2026-11-09',repeatRule:{type:'daily'}};
 d.completions['chinese@2026-11-09']={status:true};
 const html=homeBoard(d,'2026-11-09');
 assert.match(html,/aria-label="语文完成进度"[^>]*aria-valuenow="100"/);
 assert.match(html,/aria-label="数学完成进度"[^>]*aria-valuenow="0"/);
 assert.ok(!html.includes('test&gt;'));assert.ok(!html.includes('<test>'));
 assert.equal((html.match(/data-sub=/g)||[]).length,3);
 for(const subject of ['chinese','math','english'])assert.ok(html.includes(`data-sub="${subject}"`));
 assert.ok(!html.includes('board-task-grid'));
 assert.ok(!html.includes('id="add"'));
});
