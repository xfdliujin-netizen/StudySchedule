import test from 'node:test';
import assert from 'node:assert/strict';
import {client} from '../js/github-sync.js';
test('rate limited sync preserves server retry time and removes token from errors',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async()=>({ok:false,status:429,headers:new Headers({'retry-after':'120'}),json:async()=>({message:'rate limit secret-test'})});
  await assert.rejects(client({owner:'test',repo:'test',token:'secret-test'}).test(),error=>{
   assert.equal(error.status,429);assert.equal(error.retryAfterMs,120000);
   assert.ok(!error.message.includes('secret-test'));assert.match(error.message,/验证仓库/);return true;
  });
 }finally{globalThis.fetch=original;}
});
