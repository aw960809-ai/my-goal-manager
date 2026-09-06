from pathlib import Path
import re, json, collections, sys
root=Path(__file__).parent
html=(root/'index.html').read_text(encoding='utf-8')
required=['dash','goals','today','activity','scholarship','calendar','stats']
ids=re.findall(r'\bid=["\']([^"\']+)["\']',html)
dupids=sorted({x for x in ids if ids.count(x)>1})
assert not dupids, f'duplicate ids: {dupids}'
assert all(f'id="{x}"' in html for x in required), 'missing view'
texts='\n'.join(p.read_text(encoding='utf-8') for p in (root/'js').glob('*.js'))
func=set(re.findall(r'\bfunction\s+([A-Za-z_$][\w$]*)\s*\(',texts))
refs=set()
for code in re.findall(r'onclick\s*=\s*["\']([^"\']+)["\']',html): refs.update(re.findall(r'\b([A-Za-z_$][\w$]*)\s*\(',code))
missing=sorted((refs-{'if','confirm','setTimeout','clearTimeout'})-func)
assert not missing, f'missing onclick funcs: {missing}'
c=collections.Counter(re.findall(r'\bfunction\s+([A-Za-z_$][\w$]*)\s*\(',texts))
dup={k:v for k,v in c.items() if v>1}
assert not dup, f'duplicate functions: {dup}'
preview=(root/'preview.html').read_text(encoding='utf-8')
assert '__PREVIEW_CATALOG' in preview and not re.search(r'<(?:script|link)[^>]+(?:src|href)=["\']\./(?:css|js)/',preview), 'preview still depends on sibling assets'
for fn in ['activities.json','scholarships.json','events.json']:
 json.loads((root/'data'/fn).read_text(encoding='utf-8'))
print('OK: 7 views, IDs, onclick handlers, function uniqueness, preview independence, JSON')
