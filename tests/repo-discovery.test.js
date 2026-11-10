import test from 'node:test';
import assert from 'node:assert/strict';
import {privateRepositories} from '../js/github-sync.js';

test('repository discovery paginates and excludes public, archived and read-only repositories',async()=>{
 const original=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async(url,options)=>{
   assert.equal(options.headers.Authorization,'Bearer example');
   calls++;
   assert.ok(url.endsWith('page='+calls));
   return {ok:true,json:async()=>calls===1?Array.from({length:100},(_,i)=>({private:false,name:'public'+i})): [
    {private:true,name:'study',owner:{login:'parent'},permissions:{push:true}},
    {private:true,archived:true}, {private:true,permissions:{push:false}}
   ]};
  };
  assert.deepEqual(await privateRepositories('example'),[{owner:'parent',repo:'study'}]);
  assert.equal(calls,2);
  globalThis.fetch=async()=>({ok:false,status:401});
  await assert.rejects(privateRepositories('invalid'),/令牌无效/);
 }finally{globalThis.fetch=original;}
});
