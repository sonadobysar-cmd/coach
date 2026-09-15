import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseEnv } from 'node:util';
const config=parseEnv(await readFile(process.env.ELITEA_BENCH_ENV || new URL('../.env.benchmark',import.meta.url),'utf8'));
for(const key of ['AI_GATEWAY_API_KEY','VERCEL_OIDC_TOKEN']) if(config[key]) process.env[key]=config[key];
for(const key of ['DATABASE_URL','STRIPE_SECRET_KEY','NEON_AUTH_URL','NEON_AUTH_JWKS_URL','RESEND_API_KEY']) delete process.env[key];
process.env.VERCEL='1';
const { auditAnswer, auditTraining, auditCourses }=await import('../src/server.js');
const { aiMeterContext }=await import('../src/ai-meter.js');
const events=[],results=[];let reserve=0;
const out=new URL('../reports/bench-coaching.json',import.meta.url);
const context={requestId:'infinity-benchmark',sink:e=>{events.push(e);console.log(JSON.stringify({phase:e.phase,cost:e.gatewayCostUsd,cached:e.cachedInputTokens,input:e.inputTokens}));},beforeCall:args=>{
 const chars=(typeof args.instructions === 'string' ? args.instructions.length : (args.instructions || []).reduce((n,m)=>n+m.content.length,0))+(args.messages||[]).reduce((n,m)=>n+String(m.content||'').length,0);
 // Deliberately conservative reservation: one token per character, max output,
 // full input price, 3x allowance for SDK retries. Stop before exceeding $5.
 const cost=(chars*2e-6+(args.maxOutputTokens||3000)*12e-6)*3;
 if(reserve+cost>5) throw new Error('BENCHMARK_BUDGET_STOP'); reserve+=cost;
}};
const messages=[{role:'user',content:'Chci pracovat na tom, že odkládám zveřejnění své nabídky. Tykej mi prosím.'}];
try {
 for(const compact of ['0','1']) {
  process.env.ELITEA_CONTEXT_COMPACT=compact;
  const history=[...messages];
  const inputs=['Nejvíc se bojím reakce bývalých kolegyň. Nabídku mám napsanou, ale ještě jsem ji nezveřejnila.','Když si představím kritiku, začnu přepisovat text. Ráda bych dnes udělala malý konkrétní krok.'];
  for(let i=0;i<3;i++) {
   const before=events.length;
   const r=await aiMeterContext.run(context,()=>auditAnswer({messages:history,memory:{identity_preferences:{preferred_name:'Test',address_form:'tykani'}},consultationMode:'coaching_session'}));
   results.push({compact,role:'coach',turn:i,text:r.text,quality:r.qualityGate,provider:r.provider,events:events.slice(before)});
   if(events.slice(before).some(e=>e.status==='error')) throw new Error('AI_CALL_FAILED');
   history.push({role:'assistant',content:r.text});if(inputs[i])history.push({role:'user',content:inputs[i]});
  }
 }
} catch(error) { results.push({error:error.message}); }
await mkdir(new URL('.',out),{recursive:true});
await writeFile(out,JSON.stringify({reserve,events,results},null,2));
console.log(JSON.stringify({reserve,calls:events.length,results:results.map(r=>({compact:r.compact,turn:r.turn,provider:r.provider,error:r.error,quality:r.quality})),output:out.pathname}));
