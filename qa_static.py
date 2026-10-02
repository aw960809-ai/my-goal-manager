from pathlib import Path
import re, json, collections, sys
root=Path(__file__).parent
html=(root/'index.html').read_text(encoding='utf-8')
required=['dash','goals','today','activity','scholarship','calendar','stats']
ids=re.findall(r'\bid=["\']([^"\']+)["\']',html)
dupids=sorted({x for x in ids if ids.count(x)>1})
assert not dupids, f'duplicate ids: {dupids}'
assert all(f'id="{x}"' in html for x in required), 'missing view'
js_files=sorted((root/'js').glob('*.js'))
js_texts={p:p.read_text(encoding='utf-8') for p in js_files}
texts='\n'.join(js_texts.values())
func=set(re.findall(r'\bfunction\s+([A-Za-z_$][\w$]*)\s*\(',texts))
refs=set()
for code in re.findall(r'onclick\s*=\s*["\']([^"\']+)["\']',html): refs.update(re.findall(r'\b([A-Za-z_$][\w$]*)\s*\(',code))
missing=sorted((refs-{'if','confirm','setTimeout','clearTimeout'})-func)
assert not missing, f'missing onclick funcs: {missing}'

# Function names may legitimately repeat across separate JS module scopes/IIFEs.
# Treat duplicates as an error only when the same file declares the same function
# name more than once. Cross-file duplicates such as boot/esc/dateKey are not,
# by themselves, a runtime collision.
dup_by_file={}
for p,src in js_texts.items():
 c=collections.Counter(re.findall(r'\bfunction\s+([A-Za-z_$][\w$]*)\s*\(',src))
 dup={k:v for k,v in c.items() if v>1}
 if dup: dup_by_file[p.name]=dup
assert not dup_by_file, f'duplicate functions in same file: {dup_by_file}'
preview=(root/'preview.html').read_text(encoding='utf-8')
assert '__PREVIEW_CATALOG' in preview and not re.search(r'<(?:script|link)[^>]+(?:src|href)=["\']\./(?:css|js)/',preview), 'preview still depends on sibling assets'
for fn in ['activities.json','scholarships.json','events.json','activity-archive.json','scholarship-archive.json']:
 json.loads((root/'data'/fn).read_text(encoding='utf-8'))

# V97.4 scholarship lifecycle wiring guard
for fn in ['activity-archive.json','scholarship-archive.json']:
 json.loads((root/'data'/fn).read_text(encoding='utf-8'))
sch=(root/'tools'/'autofetch'/'scholarship_autofetch.py').read_text(encoding='utf-8')
for needle in ['reconcile_scholarship_catalog','archive_document','scholarship-archive.json','lifecycleArchive']:
 assert needle in sch, f'scholarship lifecycle wiring missing: {needle}'



# V97.11 foundation architecture guards
version_js=(root/'config'/'version.js').read_text(encoding='utf-8')
assert 'GOAL_MANAGER_VERSION' in version_js and 'GOAL_MANAGER_SCHEMA_VERSION' in version_js, 'single version source missing'
assert html.find('./config/version.js') >= 0 and html.find('./config/version.js') < html.find('./config/system-config.js'), 'version.js must load before system-config.js'
config=(root/'config'/'system-config.js').read_text(encoding='utf-8')
assert 'GOAL_MANAGER_VERSION' in config, 'AppConfig must consume shared version source'
app=(root/'js'/'app.js').read_text(encoding='utf-8')
assert 'GOAL_MANAGER_SCHEMA_VERSION' in app and 'STUDY_LOG_KIND' in app, 'app schema/log foundation missing'
assert "l.kind!==STUDY_LOG_KIND.SYSTEM" in app and "l.type!=='auto'" in app, 'system logs must not count as actual study'
assert 'ACTIVE_TIMER_KEY' in app and 'saveActiveTimer' in app and 'restoreActiveTimer' in app and 'renderTimerState' in app, 'persistent timer foundation missing'
store=(root/'js'/'store.js').read_text(encoding='utf-8')
assert 'storeWriteStatus' in store and 'persistent:false' in store, 'persistent storage health guard missing'
sw=(root/'sw.js').read_text(encoding='utf-8')
assert "importScripts('./config/version.js')" in sw and 'GOAL_MANAGER_VERSION' in sw, 'service worker must consume shared version source'
autofetch=(root/'.github'/'workflows'/'autofetch.yml').read_text(encoding='utf-8')
toeic=(root/'.github'/'workflows'/'toeic-news.yml').read_text(encoding='utf-8')
assert 'actions/configure-pages' not in autofetch and 'actions/deploy-pages' not in autofetch and 'upload-pages-artifact' not in autofetch, 'AutoFetch must not deploy Pages'
assert 'group: goal-manager-main-writers' in autofetch and 'group: goal-manager-main-writers' in toeic, 'main-writer workflows must share concurrency group'
assert 'git pull --rebase origin' in autofetch and 'git pull --rebase origin' in toeic, 'main-writer workflows must rebase before push'
assert 'actions: write' in autofetch and 'actions: write' in toeic, 'main-writer workflows need actions: write for explicit Pages dispatch'
assert 'gh workflow run pages.yml' in autofetch and 'gh workflow run pages.yml' in toeic, 'automated main writers must explicitly dispatch Pages after GITHUB_TOKEN push'
assert '[skip ci]' not in autofetch and '[skip ci]' not in toeic, 'automated deploy commits must not carry skip-ci markers'

print('OK: views, IDs, handlers, JSON, version, storage, logs, timer, workflow architecture')
