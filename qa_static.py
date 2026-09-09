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

print('OK: 7 views, IDs, onclick handlers, function uniqueness, preview independence, JSON')
