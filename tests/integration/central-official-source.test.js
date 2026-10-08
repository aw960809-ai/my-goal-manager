'use strict';
// Combined contract tests: Python adapters + nine-source manifest parity.
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
assert.strictEqual(names.length,9,'five existing sources and four new ones');
assert.strictEqual(new Set(names).size,9,'unique source IDs required');
assert.deepStrictEqual(new Set(names),new Set(publicRegistry.sources.map(s=>s.id)),'public registry must match actual source manifest');
for(const id of ids){
 const a=manifest.sources.find(s=>s.id===id);
 const b=publicRegistry.sources.find(s=>s.id===id);
 assert(a&&b&&a.enabled&&b.enabled,`enabled official source ${id}`);
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
assert(test.stderr.includes('Ran 9 tests'));
console.log('OK: four independent county-government adapters, nine-source registry, fail-closed and offline regression');
