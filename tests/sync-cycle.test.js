import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {emptyData} from '../js/database.js';
import {merge} from '../js/github-sync.js';

test('sync skips uploads when record order differs and still pulls changes in settings', async () => {
  const source = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  const comparison = source.slice(source.indexOf('function sameSyncData('), source.indexOf('let lastAutoSync'));
  const cycle = source.slice(source.indexOf('async function sync(options'), source.indexOf('(async function bootApp'));
  const local = emptyData();
  local.tasks = {a: {rev: 'a'}, b: {rev: 'b'}};
  const remote = emptyData();
  remote.tasks = {b: {rev: 'b'}, a: {rev: 'a'}};
  const context = vm.createContext({
    data: local, base: structuredClone(local), merge, structuredClone, choose: (_group, _id, item) => item,
    config: {owner: 'owner', repo: 'repo', token: 'fake'}, navigator: {onLine: true},
    busy: false, storageFailed: false, pendingRemotePull: false, retrySyncAt: 0,
    lastAutoSync: 0, syncFailures: 0, screen: 'settings',
    isEditing: () => false, updateSyncStatus() {}, setupRealtimePush() {},
    render() { assert.fail('Settings should not be replaced during a pull'); },
    client: () => ({pull: async () => ({data: remote}), push: async () => assert.fail('Unchanged data should not upload')}),
    write: async () => {}
  });
  vm.runInContext(comparison + cycle, context);
  await vm.runInContext('sync({quiet: true})', context);
  assert.equal(context.status, '已同步');
  remote.tasks.c = {rev: 'c'};
  await vm.runInContext('sync({quiet: true})', context);
  assert.equal(context.data.tasks.c.rev, 'c');
  assert.equal(context.status, '已同步');
});
