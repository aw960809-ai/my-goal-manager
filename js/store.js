/* Persistent store + integrity envelope. */
let memoryStore={};
let storeHealth={persistent:true,mode:'persistent',lastError:'',lastWriteAt:''};
function storeGet(k){try{return localStorage.getItem(k)}catch(e){return memoryStore[k]??null}}
function storeSet(k,v){
 try{
  localStorage.setItem(k,v);
  const ok=localStorage.getItem(k)===v;
  storeHealth={persistent:ok,mode:ok?'persistent':'memory',lastError:ok?'':'localStorage verification failed',lastWriteAt:new Date().toISOString()};
  if(!ok)memoryStore[k]=v;
  return ok;
 }catch(e){
  memoryStore[k]=v;
  storeHealth={persistent:false,mode:'memory',lastError:String(e?.message||e||'localStorage unavailable'),lastWriteAt:new Date().toISOString()};
  // Memory-only fallback is not a successful durable write.
  return false;
 }
}
function storeWriteStatus(){return {...storeHealth}}
function fnv1a(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16).padStart(8,'0')}
function stableSerialize(value){if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(stableSerialize).join(',')+']';return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableSerialize(value[k])).join(',')+'}'}
function dataPayload(d){return stableSerialize(d)}
function makeEnvelope(d){const payload=dataPayload(d);return {schemaVersion:SCHEMA_VERSION,appVersion:APP_VERSION,savedAt:new Date().toISOString(),checksum:fnv1a(payload),data:d}}
function parseEnvelope(raw){const parsed=JSON.parse(raw);if(parsed&&parsed.data&&Number.isFinite(+parsed.schemaVersion)){const payload=dataPayload(parsed.data);if(parsed.checksum&&parsed.checksum!==fnv1a(payload))throw new Error('資料完整性檢查失敗');return {data:parsed.data,schemaVersion:+parsed.schemaVersion}}return {data:parsed,schemaVersion:0}}
