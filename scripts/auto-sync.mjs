import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const state=path.join(root,'.local');fs.mkdirSync(state,{recursive:true});
const logPath=path.join(state,'auto-sync.log'),pidPath=path.join(state,'auto-sync.pid');
const log=message=>{if(fs.existsSync(logPath)&&fs.statSync(logPath).size>1048576)fs.writeFileSync(logPath,'');fs.appendFileSync(logPath,`${new Date().toISOString()} ${message}\n`);};
try{const lock=fs.openSync(pidPath,'wx');fs.writeFileSync(lock,String(process.pid));fs.closeSync(lock);}catch{
  try{process.kill(Number(fs.readFileSync(pidPath,'utf8')),0);process.exit(0);}catch(error){if(error.code!=='ESRCH')process.exit(0);}
  fs.writeFileSync(pidPath,String(process.pid));
}
process.on('exit',()=>{try{if(fs.readFileSync(pidPath,'utf8')===String(process.pid))fs.unlinkSync(pidPath);}catch{}});
const topFiles=new Set(['index.html','manifest.json','sw.js','package.json','package-lock.json','README.md','DEVELOPMENT.md','planner.md','.gitignore','启动学习计划.cmd','启动自动同步.cmd','暂停自动同步.cmd']);
const dirs=['css/','js/','assets/','scripts/','tests/','.github/'];
const allowed=name=>topFiles.has(name)||dirs.some(d=>name.startsWith(d))&&!name.split('/').some(p=>p.startsWith('.')&&p!=='.github'||p==='node_modules')&&/\.(js|mjs|ps1|cmd|html|css|svg|png|jpg|jpeg|webp|ico|json|md|yml|yaml)$/i.test(name);
function run(command,args,timeout=60000){return new Promise((resolve,reject)=>{
  const child=spawn(command,args,{cwd:root,windowsHide:true,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'never'}});let output='';
  const timer=setTimeout(()=>child.kill(),timeout);
  child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);
  child.on('error',e=>{clearTimeout(timer);reject(e);});
  child.on('close',code=>{clearTimeout(timer);resolve({code,output});});
});}
const git=(...args)=>run('git',args);
async function files(){const r=await git('ls-files','-z','--cached','--others','--exclude-standard');if(r.code)throw Error(r.output);return [...new Set(r.output.split('\0').filter(Boolean).filter(allowed))].sort();}
function digest(names){const hash=createHash('sha256');for(const name of names){hash.update(name);try{hash.update(fs.readFileSync(path.join(root,name)));}catch(e){if(e.code!=='ENOENT')throw e;hash.update('<deleted>');}}return hash.digest('hex');}
let signature='',changedAt=Date.now(),checked='',lastPush=0;
log('STARTED: watching project files; commits after 20 seconds idle.');
async function tick(){
 if(fs.existsSync(path.join(state,'auto-sync.paused')))return;
 const names=await files(),current=digest(names);
 if(current!==signature){signature=current;changedAt=Date.now();return;}
 if(Date.now()-changedAt<20000)return;
 const dirty=await git('status','--porcelain','--',...names);
 if(dirty.code)throw Error(dirty.output);
 if(dirty.output&&current!==checked){
   const tests=await run(process.execPath,['--test']);
   if(tests.code){checked=current;log('CHECK FAILED; waiting for file changes.\n'+tests.output);return;}
   for(const name of names.filter(n=>/\.(js|mjs)$/.test(n)&&fs.existsSync(path.join(root,n)))){
     const syntax=await run(process.execPath,['--check',name]);if(syntax.code){checked=current;log('SYNTAX FAILED: '+name+'\n'+syntax.output);return;}
   }
   if(fs.existsSync(path.join(state,'auto-sync.paused'))||digest(await files())!==current){signature='';return;}
   const existingStage=await git('diff','--cached','--name-only','-z');
   if(existingStage.code||existingStage.output.split('\0').filter(Boolean).some(n=>!allowed(n)))throw Error('Unrelated staged files found; refusing automatic commit.');
   // Stage only the checked paths. Preserve later file changes in the working tree.
   const stage=await git('add','--',...names);if(stage.code)throw Error(stage.output);
   if(digest(await files())!==current){signature='';return;}
   const staged=await git('diff','--cached','--quiet');
   if(staged.code===1){const commit=await git('commit','-m','Auto-sync local study planner changes');if(commit.code)throw Error(commit.output);log('COMMITTED: '+commit.output.trim());}
   checked=current;lastPush=0;
 }
 if(Date.now()-lastPush<60000)return;lastPush=Date.now();
 const remote=await git('remote','get-url','origin');
 if(remote.output.trim()!=='https://github.com/xfdliujin-netizen/StudySchedule.git')throw Error('Unexpected origin. Sync stopped for this attempt.');
 const ahead=await git('rev-list','--count','origin/main..HEAD');
 if(ahead.code)throw Error(ahead.output);
 if(Number(ahead.output)>0){
   const push=await git('push','origin','main');
   if(push.code)log('PUSH FAILED; retry in 60 seconds. No force push or automatic merge.\n'+push.output);
   else log('SYNCED: '+push.output.trim());
 }
}
async function loop(){try{await tick();}catch(e){log('ERROR: '+e.message);}setTimeout(loop,3000);}
loop();
