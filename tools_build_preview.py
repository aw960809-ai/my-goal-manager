from pathlib import Path
import json,re
root=Path(__file__).parent
html=(root/'index.html').read_text(encoding='utf-8')
css=(root/'css/base.css').read_text(encoding='utf-8')
ui_css=(root/'css/app-ui.css').read_text(encoding='utf-8')
config=(root/'config/system-config.js').read_text(encoding='utf-8')
security=(root/'js/security.js').read_text(encoding='utf-8')
settings=(root/'js/settings.js').read_text(encoding='utf-8')
store=(root/'js/store.js').read_text(encoding='utf-8')
activity=(root/'js/activity.js').read_text(encoding='utf-8')
scholarship=(root/'js/scholarship.js').read_text(encoding='utf-8')
app=(root/'js/app.js').read_text(encoding='utf-8')
bootstrap=(root/'js/bootstrap.js').read_text(encoding='utf-8')
navigation=(root/'js/navigation.js').read_text(encoding='utf-8')
devtools=(root/'js/devtools.js').read_text(encoding='utf-8')
activities=json.loads((root/'data/activities.json').read_text(encoding='utf-8'))
scholarships=json.loads((root/'data/scholarships.json').read_text(encoding='utf-8'))
legacy=json.loads((root/'data/events.json').read_text(encoding='utf-8'))
payload={'activities':activities if isinstance(activities,list) else activities.get('events',[]),'scholarships':scholarships if isinstance(scholarships,list) else scholarships.get('scholarships',[]),'legacy':legacy,'meta':{'mode':'standalone-preview','version':'V96.8.1'}}
# Strip external script tags and external stylesheet from source.
body=re.sub(r'<link rel="stylesheet" href="\./css/base\.css">\s*','',html)
body=re.sub(r'<link rel="stylesheet" href="\./css/app-ui\.css">\s*','',body)
body=re.sub(r'<script src="\./config/system-config\.js" defer></script>\s*','',body)
body=re.sub(r'<script src="\./js/security\.js" defer></script>\s*','',body)
body=re.sub(r'<script src="\./js/settings\.js" defer></script>\s*','',body)
body=re.sub(r'<script src="\./js/store\.js" defer></script>\s*','',body)
body=re.sub(r'<script src="\./js/activity\.js" defer></script>\s*','',body)
body=re.sub(r'<script src="\./js/scholarship\.js" defer></script>\s*','',body)
body=re.sub(r'<script src="\./js/app\.js" defer></script>\s*','',body)
body=re.sub(r'<script src="\./js/navigation\.js" defer></script>\s*','',body)
body=re.sub(r'<script src="\./js/pwa\.js" defer></script>\s*','',body)
body=re.sub(r'<script src="\./js/bootstrap\.js" defer></script>\s*','',body)
body=re.sub(r'<script src="\./js/catalog-lifecycle\.js" defer></script>\s*','',body)
# Inject CSS and preview data before scripts, then modules in production order.
css_tag='<style id="preview-inline-css">\n'+css+'\n'+ui_css+'\n</style>'
data_tag='<script>window.__DEV_PREVIEW__=true;window.__PREVIEW_CATALOG='+json.dumps(payload,ensure_ascii=False,separators=(',',':'))+';</script>'
scripts='\n<script>\n'+config+'\n</script>\n<script>\n'+security+'\n</script>\n<script>\n'+store+'\n</script>\n<script>\n'+settings+'\n</script>\n<script>\n'+activity+'\n</script>\n<script>\n'+scholarship+'\n</script>\n<script>\n'+app+'\n</script>\n<script>\n'+bootstrap+'\n</script>\n<script>\n'+devtools+'\n</script>\n'
body=body.replace('</head>',css_tag+'\n'+data_tag+'\n</head>')
dev_modal='''<div class="developer-modal" id="developerModal" role="dialog" aria-modal="true" aria-labelledby="developerTitle" aria-hidden="true" onclick="if(event.target===this)closeDeveloperTools()"><div class="developer-box"><div class="settings-head"><div><h2 id="developerTitle">🧪 進階測試工具</h2><p>僅測試複本，不會寫入你的正式資料</p></div><button class="settings-close" type="button" onclick="closeDeveloperTools()">×</button></div><div class="developer-body"><div class="developer-banner"><b>V96.8.1</b><span>非破壞性資料生命週期測試</span></div><button class="btn gold developer-run" type="button" onclick="runStressTests()">執行完整壓力測試</button><div id="stressResult" class="stress-result"><div class="diagnostic-empty">尚未執行壓力測試。</div></div></div></div></div>'''
body=body.replace('<div class="toast" id="toast"></div>',dev_modal+'\n<div class="toast" id="toast"></div>')

body=body.replace('</body>',scripts+'</body>')
# Standalone preview needs no SW registration and must not fetch remote data.
body=body.replace("navigator.serviceWorker.register('./sw.js').catch(()=>{});", "")
(root/'preview.html').write_text(body,encoding='utf-8')
print(root/'preview.html')
