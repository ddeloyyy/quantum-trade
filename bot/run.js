// One bot round on GitHub Actions: load the saved state, run the same engine as the page, save the state back.
// Usage: node bot/run.js data/state.json   (QT_COMMAND / QT_ADDR / QT_NAME / QT_CHAIN for owner commands)
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const file=process.argv[2]||'data/state.json';
(async()=>{
  const prev=fs.existsSync(file)?fs.readFileSync(file,'utf8'):null;
  const b=await chromium.launch({args:['--disable-web-security']});   // no browser CORS limits on a server
  const p=await b.newPage({userAgent:'QuantumTrade demo bot github.com/ddeloyyy/quantum-trade bot@users.noreply.github.com'});   // SEC asks every program to name itself
  p.on('pageerror',e=>console.error('page error:',e.message));
  p.on('console',m=>{if(m.type()==='error')console.log('page:',m.text())});
  // SEC asks every program to declare itself in the User-Agent (name + contact e-mail). curl is used because SEC's filter
  // rejects some Node defaults. Each declared name is tried once; the first one SEC accepts is kept for the whole run.
  const {execFile}=require('child_process');
  const CONTACT=process.env.QT_CONTACT||'ddeloyyy@users.noreply.github.com';
  const UAS=[`QuantumTrade ${CONTACT}`,`Quantum Trade research bot ${CONTACT}`,`ddeloyyy quantum-trade ${CONTACT}`];let uaOk=null;
  const curl=(u,ua)=>new Promise(res=>execFile('curl',['-sS','-L','--compressed','--max-time','40','-A',ua,'-H','Accept: application/json, text/xml, */*','-w','\n%{http_code}',u],{maxBuffer:64<<20},(e,out)=>{
    if(e&&!out)return res({s:0,b:String(e)});const i=out.lastIndexOf('\n');res({s:+out.slice(i+1)||0,b:out.slice(0,i)})}));
  await p.exposeFunction('nodeGet',async u=>{
    for(const ua of uaOk?[uaOk]:UAS){const r=await curl(u,ua);
      if(r.s!==403){if(!uaOk&&r.s===200){uaOk=ua;console.log('SEC accepted User-Agent:',ua)}if(r.s!==200&&r.s!==404)console.log('HTTP',r.s,u);return r}
      console.log('SEC 403 with User-Agent:',ua)}
    return {s:403,b:'SEC refused every declared User-Agent from this server'}});
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
