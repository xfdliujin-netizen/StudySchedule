import test from 'node:test';
import assert from 'node:assert/strict';
import {dailySubjectContent} from '../js/daily-learning.js';
import {emptyData, validate} from '../js/database.js';
import {merge} from '../js/github-sync.js';

test('daily material follows grade, includes local material and provides US English IPA', () => {
  const day = '2026-11-20';
  assert.notEqual(dailySubjectContent('math', day, {grade: 1}).text, dailySubjectContent('math', day, {grade: 9}).text);
  const days = Array.from({length: 10}, (_, i) => '2026-11-' + (i + 10));
  const jiangsu = {grade: 4, region: '江苏苏州'};
  assert.ok(days.some(date => dailySubjectContent('chinese', date, jiangsu).text.includes('寒山寺')));
  assert.ok(days.some(date => dailySubjectContent('english', date, jiangsu).text === 'coast'));
  for (const grade of [1, 3, 5, 7, 10]) {
    const english = dailySubjectContent('english', day, {grade});
    assert.ok(english.ipa && english.example && english.meaning && english.notes[0]);
  }
  assert.equal(dailySubjectContent('custom_science', day, jiangsu), null);
});

test('older backups default to a blank profile and sync keeps the most recent profile', () => {
  const base = validate({tasks: {}});
  assert.deepEqual(base.learningProfile, {grade: 0, region: '', updatedAt: 0});
  const local = emptyData(), remote = emptyData();
  local.learningProfile = {grade: 4, region: ' 江苏苏州 ', updatedAt: 10};
  remote.learningProfile = {grade: 5, region: '浙江杭州', updatedAt: 20};
  assert.deepEqual(merge(base, local, base).learningProfile, {grade: 4, region: '江苏苏州', updatedAt: 10});
  assert.deepEqual(merge(base, local, remote).learningProfile, remote.learningProfile);
});
