import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseEnv } from 'node:util';
const config=parseEnv(await readFile(process.env.ELITEA_BENCH_ENV || new URL('../.env.benchmark',import.meta.url),'utf8'));
for(const key of ['AI_GATEWAY_API_KEY','VERCEL_OIDC_TOKEN']) if(config[key]) process.env[key]=config[key];
for(const key of ['DATABASE_URL','STRIPE_SECRET_KEY','NEON_AUTH_URL','NEON_AUTH_JWKS_URL','RESEND_API_KEY']) delete process.env[key];
process.env.VERCEL='1';
const { auditAnswer, auditTraining, auditCourses }=await import('../src/server.js');
const { aiMeterContext }=await import('../src/ai-meter.js');
const events=[],results=[];let reserve=0;
const out=new URL('../reports/bench-cache.json',import.meta.url);
const context={requestId:'infinity-benchmark',sink:e=>{events.push(e);console.log(JSON.stringify({phase:e.phase,cost:e.gatewayCostUsd,cached:e.cachedInputTokens,input:e.inputTokens}));},beforeCall:args=>{
 const chars=(typeof args.instructions === 'string' ? args.instructions.length : (args.instructions || []).reduce((n,m)=>n+m.content.length,0))+(args.messages||[]).reduce((n,m)=>n+String(m.content||'').length,0);
 // Deliberately conservative reservation: one token per character, max output,
 // full input price, 3x allowance for SDK retries. Stop before exceeding $5.
 const cost=(chars*2e-6+(args.maxOutputTokens||3000)*12e-6)*3;
 if(reserve+cost>5) throw new Error('BENCHMARK_BUDGET_STOP'); reserve+=cost;
}};
const course=auditCourses.find(c=>c.slug==='prepis-svuj-vzorec') || auditCourses[0];
const item=course.modules.flatMap(m=>m.items).find(i=>i.type==='lesson')||course.modules[0].items[0];
const long=[];
for(let i=0;i<15;i++)long.push({role:'user',content:`Co by ti pomohlo udělat další malý krok? Zkusme se podívat na konkrétní situaci číslo ${i+1}.`},{role:'assistant',content:`Potřebuji si nejdřív vybrat menší úkol. Když si naplánuji všechno najednou, odkládám začátek. V situaci ${i+1} jsem si sepsala možnosti, ale ještě jsem žádnou nevybrala.`});
try {
 process.env.ELITEA_CONTEXT_COMPACT='1';
 const fixed=[{role:'user',content:'Vysvětli mi hlavní princip lekce a dej jeden příklad.'}];
 for(let repeat=0;repeat<3;repeat++) {
  const before=events.length;
  const r=await aiMeterContext.run(context,()=>auditTraining({messages:fixed,course,item,activity:'study',phase:'study',memory:{},difficulty:'standard'}));
  results.push({repeat,quality:r.qualityGate,text:r.text,provider:r.provider,events:events.slice(before)});
 }
} catch(error) { results.push({error:error.message}); }
await mkdir(new URL('.',out),{recursive:true});
await writeFile(out,JSON.stringify({reserve,events,results},null,2));
console.log(JSON.stringify({reserve,calls:events.length,results:results.map(r=>({compact:r.compact,turn:r.turn,provider:r.provider,error:r.error,quality:r.quality})),output:out.pathname}));
