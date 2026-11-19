import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTaskSpeech} from '../js/speech-task.js';
test('speech draft parses tomorrow weekly English and Chinese duration',()=>{
 const t=parseTaskSpeech('明天开始，每周一三五读英语二十分钟','2026-11-19');
 assert.equal(t.subjectId,'english');assert.equal(t.startDate,'2026-11-20');assert.equal(t.durationMinutes,20);
 assert.deepEqual(t.repeatRule,{type:'weekly',days:[1,3,5]});assert.match(t.title,/读英语/);
});
test('speech handles month rollover, interval and rejects ambiguous multi-subject requests',()=>{
 assert.equal(parseTaskSpeech('后天数学口算10分钟','2026-11-30').startDate,'2026-12-02');
 assert.deepEqual(parseTaskSpeech('每隔两天语文背诗15分钟','2026-11-19').repeatRule,{type:'interval',interval:2});
 assert.throws(()=>parseTaskSpeech('语文和数学都安排','2026-11-19'),/分开/);
 assert.throws(()=>parseTaskSpeech('2月30日读英语','2026-11-19'),/日期不正确/);
 assert.equal(parseTaskSpeech('数学练习','2026-11-19').repeatRule.type,'once');
});
