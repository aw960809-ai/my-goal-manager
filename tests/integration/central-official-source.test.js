'use strict';
// Combined contract tests: Python adapters + fourteen-source manifest parity.
// No network or personal/browser data access is used by this test.
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const {spawnSync}=require('child_process');
const root=path.resolve(__dirname,'../..');
const activity=fs.readFileSync(path.join(root,'tools/autofetch/autofetch.py'),'utf8');
const pythonSource=fs.readFileSync(path.join(root,'tools/autofetch/central_official.py'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'tools/autofetch/sources.json'),'utf8'));
const publicRegistry=JSON.parse(fs.readFileSync(path.join(root,'data/activity-sources.json'),'utf8'));
const ids=['miaoli_government','changhua_government','nantou_culture','yunlin_government'];
const names=manifest.sources.map(s=>s.id);
assert.strictEqual(names.length,14,'twelve prior sources plus two nationwide youth sources');
assert.strictEqual(new Set(names).size,14,'unique source IDs required');
assert.deepStrictEqual(new Set(names),new Set(publicRegistry.sources.map(s=>s.id)),'public registry must match actual source manifest');
// Expansion must preserve all original sources, not just increase a counter.
const priorSourceIds=['thu_official','taichung_job','pathfinder_official',
  'mofa_working_holiday','yda_official','miaoli_government',
  'changhua_government','nantou_culture','yunlin_government'];
assert.deepStrictEqual(new Set(names),new Set([...priorSourceIds,'moc_national','ntu_law','nccu_law','youthfirst_national','yda_national_news']),
  'must retain original sources, culture feed, and two official law schools');
const nation=manifest.sources.find(s=>s.id==='moc_national');
const nationPublic=publicRegistry.sources.find(s=>s.id==='moc_national');
assert(nation&&nationPublic&&nation.enabled&&nationPublic.enabled,
  'national source must be enabled in both official registries');
assert.strictEqual(nation.scope,'national');
assert.strictEqual(nationPublic.scope,'nationwide');
assert.deepStrictEqual(nation.domain_allowlist,['cloud.culture.tw']);
assert(nation.start_urls.length===4&&nation.start_urls.every(u=>u.startsWith('https://cloud.culture.tw/')),
  'nationwide inputs must use four verified HTTPS official endpoints');
assert.deepStrictEqual(nation.start_urls,nationPublic.startUrls);
for(const [id,domain] of [['ntu_law','www.law.ntu.edu.tw'],['nccu_law','law.nccu.edu.tw']]){
  const manifestRow=manifest.sources.find(x=>x.id===id);
  const publicRow=publicRegistry.sources.find(x=>x.id===id);
  assert(manifestRow&&publicRow&&!manifestRow.enabled&&!publicRow.enabled,`disabled ${id} by preference`);
  assert(manifestRow.scope==='national'&&publicRow.scope==='nationwide');
  assert.deepStrictEqual(manifestRow.domain_allowlist,[domain]);
  assert.deepStrictEqual(manifestRow.start_urls,publicRow.startUrls);
  assert(publicRow.profileMatch.cities.length===0,'public national scope must not infer user residence');
}
// Nationwide expansion must keep disabled sources disabled and manifest parity.
for(const [id,domain] of [['youthfirst_national','youthfirst.yda.gov.tw'],
                           ['yda_national_news','www.yda.gov.tw']]){
  const actual=manifest.sources.find(x=>x.id===id),pub=publicRegistry.sources.find(x=>x.id===id);
  assert(actual&&pub&&actual.enabled&&pub.enabled);
  assert.strictEqual(actual.scope,'national');
  assert.strictEqual(pub.scope,'nationwide');
  assert.deepStrictEqual(actual.domain_allowlist,[domain]);
  assert.deepStrictEqual(actual.start_urls,pub.startUrls);
  assert(pub.profileMatch.cities.length===0,'Nationwide is not personal location data');
}
for(const id of ids){
 const a=manifest.sources.find(s=>s.id===id);
 const b=publicRegistry.sources.find(s=>s.id===id);
 assert(a&&b&&a.enabled===b.enabled,`manifest parity ${id}`);
 const enabled=false; // regional scrapers disabled by user preference
 assert.strictEqual(a.enabled,enabled,`source enabled only after live health test ${id}`);
 assert(a.scope==='regional'&&b.scope==='regional',`Circle 3 ${id}`);
 assert(a.start_urls.length===1&&a.start_urls[0].startsWith('https://'),`https ${id}`);
 assert(b.startUrls[0]===a.start_urls[0],`manifest consistency ${id}`);
 assert(b.profileMatch.cities.length===1,`county match ${id}`);
 assert(!b.profileMatch.schoolNames.length,`regional info must not impersonate THU ${id}`);
}
assert(activity.includes('CIRCLE_META.update({_sid:(3,\'中部\',2) for _sid in CENTRAL_REGIONS})'));
assert(activity.includes('run_central_source('));
assert(activity.includes('results = [apply_fit_to_result(r) for r in results]'), 'do not bypass existing fit policy');
assert(activity.includes('reconcile_activity_catalog('), 'do not bypass existing lifecycle');
assert(pythonSource.includes('network_errors==0 and structural_errors==0'), 'source outage must be fail-closed');
const test=spawnSync('python3',['tests/autofetch/test_central_official.py'],{cwd:root,encoding:'utf8',timeout:30000});
assert.strictEqual(test.status,0,`${test.stdout}\n${test.stderr}`);
assert(test.stderr.includes('Ran 10 tests'));
console.log('OK: four county adapters, original ten sources preserved + two nationwide law-school sources, fail-closed QA');
