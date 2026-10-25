// One bot round on GitHub Actions: load the saved state, run the same engine as the page, save the state back.
// Usage: node bot/run.js data/state.json   (QT_COMMAND / QT_ADDR / QT_NAME / QT_CHAIN for owner commands)
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const file=process.argv[2]||'data/state.json';
(async()=>{
  const prev=fs.existsSync(file)?fs.readFileSync(file,'utf8'):null;
  const b=await chromium.launch({args:['--disable-web-security']});   // no browser CORS limits on a server
  const p=await b.newPage({userAgent:'QuantumTrade demo bot github.com/ddeloyyy/quantum-trade bot@users.noreply.github.com'});   // SEC asks every program to name itself
  p.on('pageerror',e=>console.error('page error:',e.message));
  await p.addInitScript(([s])=>{window.SERVER_RUN=1;if(s)localStorage.setItem('quantum-trade-live-v2',s)},[prev]);
  await p.goto('file://'+path.resolve(__dirname,'..','index.html'));
  await p.waitForFunction(()=>{try{return !!(S&&S.acc)}catch(e){return false}},null,{timeout:30000});
  const cmd=process.env.QT_COMMAND||'run';
  if(cmd!=='run'){const r=await p.evaluate(([c,a,n,ch])=>{const x=CMD[c];if(!x)return 'unknown command '+c;return x(a,n,ch)||''},[cmd,process.env.QT_ADDR||'',process.env.QT_NAME||'',process.env.QT_CHAIN||'']);
    console.log('command',cmd,r||'ok')}
  if(cmd!=='cashout'&&cmd!=='stop'){
    await p.evaluate(async()=>{lastSlow=0;await tick();await tick()},null);   // first pass loads every source, second one trades on fresh data
  }
  const out=await p.evaluate(()=>{S.lastRun=Date.now();return JSON.stringify(S)});
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,out);
  const s=JSON.parse(out);console.log(`equity ${s.curve.at(-1)?.[1]} · positions ${Object.keys(s.acc.pos).length} · trades ${s.trades.length} · ${(out.length/1024).toFixed(0)} KB`);
  await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
