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
assert 'StudyLogDomain.normalizeLog' in app and 'StudyLogDomain.isCountableActualLog' in app, 'study log compatibility delegation missing'
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
assert './css/tokens.css' in html and './css/design-system.css' in html, 'design system CSS must load explicitly'
assert all(x not in html for x in ['theme-v9793.css','theme-v9794.css','theme-v9795.css']), 'retired theme CSS must not load from HTML'
cfg=(root/'config'/'system-config.js').read_text(encoding='utf-8')
assert all(x not in cfg for x in ['theme-v9793.css','theme-v9794.css','theme-v9795.css']), 'retired dynamic theme loaders remain'
tokens=(root/'css'/'tokens.css').read_text(encoding='utf-8')
design=(root/'css'/'design-system.css').read_text(encoding='utf-8')
for needle in ['--gm-primary:#596A85','--gm-accent:#886B78','--gm-bg:#F3F1EE','--gm-font-size-body:16px','--gm-space-4:16px']:
 assert needle in tokens, f'design token missing: {needle}'
assert '--ui-green:var(--gm-primary)' in design and '--ui-gold:var(--gm-accent)' in design, 'legacy aliases must map to canonical tokens'
sw=(root/'sw.js').read_text(encoding='utf-8')
assert 'tokens.css' in sw and 'design-system.css' in sw and 'theme-v9793.css' not in sw, 'service worker CSS shell is stale'
assert all(x not in html for x in ['🎯','📍','🔎','📅']), 'high-saturation emoji remains in primary UI'
execution_ui_guard=(root/'js'/'ui'/'pages'/'execution-page.js').read_text(encoding='utf-8')
assert 'today-path' in execution_ui_guard and 'today-metrics' in execution_ui_guard, 'execution card compact hierarchy missing'
assert '<button class="btn primary" onclick="startTodayExecution' in execution_ui_guard, 'execution CTA must use primary color'
assert 'mobile polish - visual priority after device review' in design, 'mobile polish CSS missing'
assert 'goal-tree mobile layout hotfix' in design and 'grid-template-columns:42px minmax(0,1fr)' in design, 'goal mobile layout hotfix missing'
assert 'final visual cleanup - residual legacy color and mobile scan fixes' in design, 'final visual cleanup missing'
assert 'calendar hero cleanup' in design, 'calendar hero cleanup missing'
nav_match=re.search(r'<nav class="bottom-nav".*?</nav>',html,re.S)
assert nav_match, 'bottom navigation missing'
primary_nav=nav_match.group(0)
assert primary_nav.count('data-view=')==5, 'primary navigation must contain exactly five destinations'
assert 'data-view="activity"' not in primary_nav and 'data-view="scholarship"' not in primary_nav, 'Explore views must not occupy primary navigation'
assert 'home-explore-panel' in html and "go('activity')" in html and "go('scholarship')" in html, 'Home Explore entry missing'
assert 'homeDateLabel' in html and 'dTodayMin' in html, 'Home daily summary missing'
assert 'executionNowPanel' in html and 'other-study-disclosure' in html and 'studyBackfillMode' in html, 'execution information architecture missing'
assert "const navId=(id==='activity'||id==='scholarship')?'dash':id;" in app, 'subview navigation ownership missing'
assert "panel.classList.toggle('has-selection',has)" in app, 'sticky timer state binding missing'
assert '97.13.0 information architecture' in design and 'repeat(5,minmax(0,1fr))' in design, 'phase 3 design rules missing'
goal_domain=(root/'js'/'domain'/'goals.js').read_text(encoding='utf-8')
goal_test=(root/'tests'/'goal-domain.test.js').read_text(encoding='utf-8')
assert './js/domain/goals.js' in html and html.find('./js/domain/goals.js') < html.find('./js/app.js'), 'GoalDomain must load before app.js'
assert all(x in goal_domain for x in ['getTask','children','roots','ancestors','periodForTask','browseItems']), 'GoalDomain API incomplete'
assert 'GoalDomain.getTask' in app and 'GoalDomain.children' in app and 'GoalDomain.periodForTask' in app, 'app.js must delegate hierarchy helpers'
assert 'goalBrowsePanel' in html and 'goalMapPanel' in html and 'goalBrowseTab' in html and 'goalMapTab' in html, 'goal dual-mode UI missing'
assert all(x in app for x in ['renderGoalsPage','renderGoalBrowse','setGoalViewMode','browseGoalUp','focusGoalSearch']), 'goal browse controller missing'
assert '97.14.0 goal dual-mode navigation' in design, 'phase 4 goal design rules missing'
assert 'GoalDomain hierarchy, path, browse and period helpers' in goal_test, 'GoalDomain test missing'
assert './js/domain/goals.js' in sw, 'service worker missing GoalDomain module'
toeic_plan=(root/'js'/'domain'/'toeic-plan.js').read_text(encoding='utf-8')
assert './js/domain/toeic-plan.js' in html and html.find('./js/domain/toeic-plan.js') < html.find('./js/app.js'), 'ToeicPlanDomain must load before app.js'
assert './js/domain/toeic-plan.js' in sw, 'service worker missing ToeicPlanDomain module'
assert all(x in toeic_plan for x in ['taskSpecs','apply','targetTaskId','inferUnit','aggregateProgress','progressAliases']), 'ToeicPlanDomain API incomplete'
assert 'ToeicPlanDomain.apply' in app and 'ToeicPlanDomain.aggregateProgress' in app, 'app.js missing TOEIC plan delegation'

# V98 Domain Core guards
study_domain=(root/'js'/'domain'/'study-logs.js').read_text(encoding='utf-8')
execution_domain=(root/'js'/'domain'/'execution.js').read_text(encoding='utf-8')
analytics_domain=(root/'js'/'domain'/'analytics.js').read_text(encoding='utf-8')
for module in ['./js/domain/study-logs.js','./js/domain/execution.js','./js/domain/analytics.js']:
 assert module in html and html.find(module) < html.find('./js/app.js'), f'{module} must load before app.js'
 assert module in sw, f'service worker missing {module}'
assert all(x in study_domain for x in ['normalizeLog','isCountableActualLog','isOtherStudyLog','isGoalActualLog','goalStudyMinutesInRange','totalStudyMinutesInRange']), 'StudyLogDomain API incomplete'
assert all(x in execution_domain for x in ['currentWeekSummary','leafProgress','executionSummary','activeExecutionPlan','activeWeeklyTargetTotal']), 'ExecutionDomain API incomplete'
assert all(x in analytics_domain for x in ['analysisValidLeafTasks','weeklyStudySummary','weeklyDirectionSummary','executionAnalysis']), 'AnalyticsDomain API incomplete'
assert 'StudyLogDomain.logDate' in app and 'ExecutionDomain.currentWeekSummary' in app and 'AnalyticsDomain.weeklyDirectionSummary' in app, 'Domain compatibility wrappers missing'
calendar_domain=(root/'js'/'domain'/'calendar.js').read_text(encoding='utf-8')
timer_service=(root/'js'/'services'/'timer-service.js').read_text(encoding='utf-8')
assert './js/domain/calendar.js' in html and html.find('./js/domain/calendar.js') < html.find('./js/app.js'), 'CalendarDomain must load before app.js'
assert './js/services/timer-service.js' in html and html.find('./js/services/timer-service.js') < html.find('./js/app.js'), 'TimerService must load before app.js'
assert './js/domain/calendar.js' in sw and './js/services/timer-service.js' in sw, 'service worker missing CalendarDomain/TimerService'
assert all(x in calendar_domain for x in ['dateKey','monthGridKeys','eventsForDate','monthCounts']), 'CalendarDomain API incomplete'
assert all(x in timer_service for x in ['empty','normalize','payload','hasSelection','start','pause','elapsedMs','finish']), 'TimerService API incomplete'
assert 'CalendarDomain.dateKey' in app and 'CalendarDomain.monthGridKeys' in app, 'calendar compatibility wrappers missing'
assert 'TimerService.start' in app and 'TimerService.pause' in app and 'TimerService.finish' in app, 'timer compatibility delegation missing'
execution_service=(root/'js'/'services'/'execution-service.js').read_text(encoding='utf-8')
data_normalization=(root/'js'/'data'/'normalization.js').read_text(encoding='utf-8')
data_migrations=(root/'js'/'data'/'migrations.js').read_text(encoding='utf-8')
data_repository=(root/'js'/'data'/'repository.js').read_text(encoding='utf-8')
for module in ['./js/services/execution-service.js','./js/data/normalization.js','./js/data/migrations.js','./js/data/repository.js']:
 assert module in html and html.find(module) < html.find('./js/app.js'), f'{module} must load before app.js'
 assert module in sw, f'service worker missing {module}'
assert all(x in execution_service for x in ['createPlan','cancelPlan','applyActualMinutes','findActivePlanForDate']), 'ExecutionService API incomplete'
assert all(x in data_normalization for x in ['normalizeTask','normalizeTasks','normalizeWeekReviews']), 'DataNormalization API incomplete'
assert 'migrate' in data_migrations, 'DataMigrations API incomplete'
assert 'readCandidate' in data_repository, 'DataRepository API incomplete'
assert 'DataNormalization.normalizeTasks' in app and 'DataMigrations.migrate' in app and 'DataRepository.readCandidate' in app, 'Data layer delegation missing'
assert 'ExecutionService.applyActualMinutes' in app and 'ExecutionService.createPlan' not in app and 'ExecutionService.cancelPlan' not in app, 'active app must retain only legacy planId completion compatibility'
calendar_page=(root/'js'/'ui'/'pages'/'calendar-page.js').read_text(encoding='utf-8')
execution_page=(root/'js'/'ui'/'pages'/'execution-page.js').read_text(encoding='utf-8')
for module in ['./js/ui/pages/calendar-page.js','./js/ui/pages/execution-page.js']:
 assert module in html and html.find(module) < html.find('./js/app.js'), f'{module} must load before app.js'
 assert module in sw, f'service worker missing {module}'
assert all(x in calendar_page for x in ['summaryButton','agendaHTML','render']), 'CalendarPage API incomplete'
assert all(x in execution_page for x in ['todayItemHTML','todayListHTML','renderToday']), 'ExecutionPage API incomplete'
assert 'CalendarPage.render' in app and 'ExecutionPage.renderToday' in app and 'ExecutionPage.renderPlannedQueue' not in app, 'UI page delegation missing'
goals_page=(root/'js'/'ui'/'pages'/'goals-page.js').read_text(encoding='utf-8')
analytics_page=(root/'js'/'ui'/'pages'/'analytics-page.js').read_text(encoding='utf-8')
for module in ['./js/ui/pages/goals-page.js','./js/ui/pages/analytics-page.js']:
 assert module in html and html.find(module) < html.find('./js/app.js'), f'{module} must load before app.js'
 assert module in sw, f'service worker missing {module}'
assert all(x in goals_page for x in ['browseMeta','browseCard','renderBrowse','resultCard','renderSearchResults','taskNode','renderTree']), 'GoalsPage API incomplete'
assert all(x in analytics_page for x in ['formatMinutes','renderStats','deletedLogsHTML','recentActualLogsHTML','actualHistoryModalShell','actualHistoryBodyHTML','weeklyReviewHTML']), 'AnalyticsPage API incomplete'
assert 'GoalsPage.renderBrowse' in app and 'GoalsPage.renderSearchResults' in app and 'GoalsPage.taskNode' in app and 'GoalsPage.renderTree' in app, 'GoalsPage delegation missing'
assert 'AnalyticsPage.renderStats' in app and 'AnalyticsPage.renderExecutionAnalysis' not in app and 'AnalyticsPage.recentActualLogsHTML' in app and 'AnalyticsPage.actualHistoryBodyHTML' in app and 'AnalyticsPage.weeklyReviewHTML' in app, 'AnalyticsPage delegation missing'
dashboard_page=(root/'js'/'ui'/'pages'/'dashboard-page.js').read_text(encoding='utf-8')
app_orchestrator=(root/'js'/'application'/'orchestrator.js').read_text(encoding='utf-8')
for module in ['./js/ui/pages/dashboard-page.js','./js/application/orchestrator.js']:
 assert module in html and html.find(module) < html.find('./js/app.js'), f'{module} must load before app.js'
 assert module in sw, f'service worker missing {module}'
assert all(x in dashboard_page for x in ['executeListHTML','renderExecuteList','decisionListHTML','renderDecisionList','directionsHTML','deadlinesHTML','renderDashboard']), 'DashboardPage API incomplete'
assert 'renderAll' in app_orchestrator, 'AppOrchestrator API incomplete'
assert 'DashboardPage.renderDashboard' in app and 'DashboardPage.renderExecuteList' in app and 'DashboardPage.renderDecisionList' in app, 'DashboardPage delegation missing'
assert 'AppOrchestrator.renderAll' in app, 'renderAll orchestration delegation missing'
data_persistence=(root/'js'/'data'/'persistence.js').read_text(encoding='utf-8')
assert './js/data/persistence.js' in html and html.find('./js/data/persistence.js') < html.find('./js/app.js'), 'DataPersistence must load before app.js'
assert './js/data/persistence.js' in sw, 'service worker missing DataPersistence'
assert all(x in data_persistence for x in ['rotateBackups','persist','loadFirstValid']), 'DataPersistence API incomplete'
assert 'DataPersistence.persist' in app and 'DataPersistence.loadFirstValid' in app, 'persistence delegation missing'
bootstrap=(root/'js'/'bootstrap.js').read_text(encoding='utf-8')
assert html.find('./js/bootstrap.js') > html.find('./js/app.js'), 'bootstrap must load after app.js'
assert 'window.renderAll()' in bootstrap and 'window.__goalManagerBooted' in bootstrap, 'bootstrap render ownership missing'
assert not app.rstrip().endswith('renderAll();'), 'app.js still self-renders instead of bootstrap'
assert 'dashboard:{render:window.dashboard}' in bootstrap and 'goals:{render:window.renderGoalsPage}' in bootstrap and 'execution:{render:window.today}' in bootstrap and 'analytics:{render:window.stats}' in bootstrap, 'AppModules still expose broad renderAll aliases'
pwa=(root/'js'/'pwa.js').read_text(encoding='utf-8')
assert "new URL('./config/version.js',location.href)" in pwa, 'PWA update check must use canonical version.js'
assert 'GOAL_MANAGER_VERSION\\s*=\\s*' in pwa, 'PWA remote version parser missing'
assert 'source.match(/const\\s+PWA_VERSION' not in pwa, 'stale SW literal-version parser remains'


assert "const KEY='lawLangGoalSystemV92'" in app and 'BACKUP_KEYS' in app, 'persistent keys must remain stable'

assert "GOAL_MANAGER_VERSION='98.13.4'" in version_js, 'V98.13.4 version source missing'





radar_policy=(root/'js'/'domain'/'radar-policy.js').read_text(encoding='utf-8')
activity=(root/'js'/'activity.js').read_text(encoding='utf-8')
scholarship=(root/'js'/'scholarship.js').read_text(encoding='utf-8')
assert './js/domain/radar-policy.js' in html and html.find('./js/domain/radar-policy.js') < html.find('./js/activity.js'), 'RadarPolicy must load before activity.js'
assert './js/domain/radar-policy.js' in sw, 'service worker missing RadarPolicy'
assert all(x in radar_policy for x in ['activityCircleInfo','activityReviewState','scholarshipRegionReason']), 'RadarPolicy API incomplete'
assert 'RadarPolicy.activityCircleInfo' in activity and 'RadarPolicy.activityReviewState' in activity, 'activity radar policy delegation missing'
assert "3:'③ 中部'" in radar_policy and "4:'④ 全國'" in radar_policy, 'activity concentric circles do not match final specification'
assert 'RadarPolicy.scholarshipRegionReason' in scholarship and 'excludeAnyRegionalRestriction:true' in scholarship, 'strict scholarship region policy missing'


orchestrator_runtime=(root/'js'/'application'/'orchestrator.js').read_text(encoding='utf-8')
analytics_runtime=(root/'js'/'ui'/'pages'/'analytics-page.js').read_text(encoding='utf-8')
assert 'catch(error)' in orchestrator_runtime and 'errors.push(entry)' in orchestrator_runtime, 'AppOrchestrator render fault isolation missing'
assert "if(id==='stats')stats();" in app, 'analytics view must render directly on navigation'
assert "if(id==='today'){today();renderTimerState();}" in app, 'execution view must refresh directly on navigation'
assert all(x in analytics_runtime for x in ['setText','setHTML','setWidth']), 'AnalyticsPage safe DOM helpers missing'

print('OK: views, IDs, handlers, JSON, version, storage, logs, timer, workflows, design system, phase3 IA, phase4 goals, V98 domain core, V98.1 calendar/timer, V98.2 execution/data, V98.3 UI pages, V98.4 goals/analytics pages, V98.5 UI cleanup, V98.6 dashboard/orchestration, V98.7 persistence, V98.8 bootstrap/regression, V98.9 radar accuracy, V98.9.1 analytics runtime')

# V98.11.2 study-history durability guards
history_guard=(root/'js'/'data'/'history-guard.js').read_text(encoding='utf-8')
persistence_guard=(root/'js'/'data'/'persistence.js').read_text(encoding='utf-8')
settings_guard=(root/'js'/'settings.js').read_text(encoding='utf-8')
assert './js/data/history-guard.js' in html and html.find('./js/data/history-guard.js') < html.find('./js/app.js'), 'HistoryGuard must load before app.js'
assert './js/data/history-guard.js' in sw, 'service worker missing HistoryGuard'
assert 'HistoryGuard.assertPreserved' in app and 'HISTORY_ANCHOR_KEY' in app and 'ensureHistoryAnchor();' in app, 'study-history runtime protection missing'
assert 'allowLogReplacement' in app, 'explicit destructive-write escape hatch missing'
assert 'guard:({oldRaw,nextData})' in app, 'DataPersistence history guard wiring missing'
assert 'Rotate only after the new primary copy has passed integrity checks' in persistence_guard, 'backup rotation must happen after verified primary write'
assert 'Best-effort rollback of the primary copy' in persistence_guard, 'verified-write rollback missing'
assert '歷程安全基準' in settings_guard, 'settings history anchor visibility missing'
assert "GOAL_MANAGER_VERSION='98.13.4'" in version_js, 'V98.13.4 version source missing'


# V98.11.2 radar UI and source-health coherence
assert '<option value="中部">③ 中部</option>' in html, 'activity UI missing Central Taiwan circle'
assert '<option value="全國">④ 全國</option>' in html, 'activity UI missing Nationwide circle 4'
assert '<option value="海外／國際">④ 海外／國際</option>' not in html, 'international still incorrectly rendered as circle 4'
assert '<b>③ 中部</b>' in html and '<b>④ 全國</b>' in html, 'activity radar guide is stale'
autofetch_health=(root/'js'/'autofetch-health.js').read_text(encoding='utf-8')
assert 'syncActivityLoadState' in autofetch_health and '__activityRemoteRetryDone' in autofetch_health, 'activity source-health/list-load retry bridge missing'
assert "GOAL_MANAGER_VERSION='98.13.4'" in version_js, 'V98.13.4 version source missing'

activity_runtime=(root/'js'/'activity.js').read_text(encoding='utf-8')
assert 'function activitySort(a,b)' in activity_runtime, 'activitySort comparator missing; activity list render will fail'
assert '(b.fit.score-a.fit.score)' in activity_runtime and '(a.fit.circleLevel-b.fit.circleLevel)' in activity_runtime, 'activitySort ordering contract changed'

# Compact source-review UX
activity_runtime=(root/'js'/'activity.js').read_text(encoding='utf-8')
assert 'activity-review-disclosure' in activity_runtime and '暫不列入推薦 · 點擊展開' in activity_runtime, 'source review must be collapsed by default'


# V98.11.2 published source-review collapse guard
activity_runtime=(root/'js'/'activity.js').read_text(encoding='utf-8')
assert '<details class="activity-review-disclosure">' in activity_runtime, 'source-review collapse markup missing'
assert '暫不列入推薦 · 點擊展開' in activity_runtime, 'source-review collapse summary missing'
assert "GOAL_MANAGER_VERSION='98.13.4'" in version_js, 'V98.13.4 version source missing'


# V98.11.2 global time-accounting invariants
execution_time_guard=(root/'js'/'domain'/'execution.js').read_text(encoding='utf-8')
analytics_time_guard=(root/'js'/'domain'/'analytics.js').read_text(encoding='utf-8')
analytics_ui_time_guard=(root/'js'/'ui'/'pages'/'analytics-page.js').read_text(encoding='utf-8')
assert 'function timeAccounting(planned,actual)' in execution_time_guard, 'global timeAccounting helper missing'
assert 'function activeWeeklyAccounting(tasks,logs,date)' in execution_time_guard, 'per-action weekly accounting missing'
assert all(x in analytics_time_guard for x in ['creditedGoalMinutes','overrunGoalMinutes','creditedPlanMinutes','overrunPlanMinutes','remainingPlanMinutes']), 'analytics must separate raw actual, credited progress and overrun'
assert 'statsCredited' in html and 'statsOverrun' in html, 'weekly accounting visibility missing'
assert "setText(document,'statsCredited'" in analytics_ui_time_guard and "setText(document,'statsOverrun'" in analytics_ui_time_guard, 'weekly accounting visibility missing'


# V98.11.2 bounded PWA update settlement
pwa_bounded=(root/'js'/'pwa.js').read_text(encoding='utf-8')
sw_bounded=(root/'sw.js').read_text(encoding='utf-8')
assert 'UPDATE_SETTLE_MAX_MS=30*1000' in pwa_bounded and 'function updateWaitExpired()' in pwa_bounded, 'PWA settlement timeout guard missing'
assert 'UPDATE_SETTLE_RETRY_MS=3*1000' in pwa_bounded, 'PWA settlement retry interval missing'
assert 'const CRITICAL_SHELL=[' in sw_bounded and 'async function warmInstallCache(urls)' in sw_bounded, 'bounded service-worker install missing'
assert 'await cache.addAll(APP_SHELL)' not in sw_bounded, 'service-worker install still blocks on full app shell'


# V98.11.2 direct-execution retirement of schedule-plan product flow
execution_ui_direct=(root/'js'/'ui'/'pages'/'execution-page.js').read_text(encoding='utf-8')
analytics_ui_direct=(root/'js'/'ui'/'pages'/'analytics-page.js').read_text(encoding='utf-8')
dashboard_ui_direct=(root/'js'/'ui'/'pages'/'dashboard-page.js').read_text(encoding='utf-8')
assert 'execution-planned-panel' not in html and 'plannedQueue' not in html, 'scheduled execution queue still visible'
assert '安排執行' not in app and 'goalSchedulePanel' not in app and 'saveExecutionPlan' not in app, 'schedule-plan creation UI/runtime still active'
assert 'findActivePlanForDate' not in app, 'direct execution must not auto-match legacy plans'
assert "TimerService.selectGoal(id,null)" in app, 'direct execution must select Level 4 without planId'
assert 'executionPlans=Array.isArray(d.executionPlans)?d.executionPlans:[]' in app, 'legacy executionPlans must remain readable for old backups'
assert 'ExecutionService.applyActualMinutes' in app, 'old restored timer planId compatibility must remain'
assert 'plannedQueueHTML' not in execution_ui_direct and 'renderPlannedQueue' not in execution_ui_direct, 'dead schedule queue renderer remains'
assert 'weeklyTargetMinutes' in dashboard_ui_direct and 'weeklyPlanMinutes' not in dashboard_ui_direct, 'dashboard must show weekly goal target, not scheduled-plan time'
assert 'weeklyDirectionSummary' in analytics_domain and all(x in analytics_ui_direct for x in ['實際 ${TimeFormat.minutes(actual)} 分','有效 ${TimeFormat.minutes(credited)} 分','超時 ${TimeFormat.minutes(overrun)} 分','目標 ${TimeFormat.minutes(target)} 分']), 'direction analytics must show real weekly accounting'
assert 'executionAnalysisHTML' not in analytics_ui_direct and 'renderExecutionAnalysis' not in analytics_ui_direct, 'plan-centric analytics UI remains active'
assert 'stats-week-ratio' in html and 'stats-week-ratio' in design, 'mobile weekly ratio nowrap fix missing'


# V98.11.2 unified manual study backfill
assert '補登學習' in html and 'goalStudyBackfillTask' in html and 'goalStudyBackfillDate' in html and 'goalStudyBackfillMinutes' in html, 'goal-study backfill UI missing'
assert 'function addGoalStudyLog()' in app and "source:'manual-backfill'" in app and 'kind:STUDY_LOG_KIND.GOAL' in app, 'goal-study manual backfill runtime missing'
assert "if(date>todayKey())" in app and 'date<p.start||date>p.due' in app, 'goal-study backfill date guards missing'
assert "source:'manual-backfill',planId" not in app, 'manual backfill must never attach an execution plan'
assert 'function syncStudyBackfillMode()' in app and 'function syncStudyBackfillForm()' in app, 'unified backfill mode controller missing'
assert 'otherStudyBackfillFields' in html and 'addOtherStudyLog()' in html, 'other-study backfill workflow must remain available'


# V98.11.2 date-aware compact goal-study backfill selector
assert 'goalStudyBackfillDate" type="date" onchange="syncGoalStudyBackfillOptions()"' in html, 'backfill date must refresh eligible Level 4 options'
assert 'function goalStudyBackfillTasks(date=todayKey())' in app and 'day>=p.start&&day<=p.due' in app, 'backfill selector must filter by chosen date'
assert 'function goalStudyBackfillLabel(t)' in app and 'parent?`${parent.name} › ${t.name}`' in app, 'backfill option labels must stay compact'
assert '沒有有效具體實現' in app, 'empty eligible backfill state missing'


# V98.11.2 direct free-study timer
assert 'freeStudyQuickStart' in html and 'freeStudyName' in html and 'startFreeStudyTimer()' in html, 'free-study quick-start UI missing'
assert 'function startFreeStudyTimer()' in app and 'TimerService.selectOther(name)' in app, 'free-study timer runtime missing'
assert 'function selectOtherStudyTimer()' not in app and 'selectOtherStudyTimer()' not in html, 'timer must not live inside the backfill workflow'
assert 'free-study-quick-start' in design and 'free-study-quick-row' in design, 'free-study mobile styles missing'

# V98.11.3 shared time-display boundary
time_format=(root/'js'/'ui'/'time-format.js').read_text(encoding='utf-8')
assert './js/ui/time-format.js' in html and html.find('./js/ui/time-format.js') < html.find('./js/ui/pages/calendar-page.js'), 'TimeFormat must load before page renderers'
assert './js/ui/time-format.js' in sw, 'service worker missing TimeFormat'
assert all(x in time_format for x in ['wholeMinutes','hoursLabel','human','shortEnglish']), 'TimeFormat API incomplete'
assert all('TimeFormat.minutes' in page for page in [dashboard_page,execution_page,goals_page,analytics_page]), 'page renderers must share TimeFormat minute formatting'


# V98.11.4 compact actual-history journal
history_ui=(root/'js'/'ui'/'pages'/'analytics-page.js').read_text(encoding='utf-8')
history_css=(root/'css'/'app-ui.css').read_text(encoding='utf-8')
assert all(x in history_ui for x in [
  'actualHistoryDayLabel',
  'actualHistoryClusterKey',
  'actual-history-cluster',
  'actual-history-filter',
  'TimeFormat.human'
]), 'compact actual-history journal helpers missing'
assert all(x in history_css for x in [
  '.actual-history-toolbar',
  '.actual-history-filter',
  '.actual-history-cluster',
  '.actual-history-row-compact'
]), 'compact actual-history styles missing'
assert '累積紀錄' in html and '<div class="mini-label">筆</div>' in html, 'actual-log KPI wording must describe persistent records'
assert 'same.length<3' in history_ui, 'adaptive history grouping threshold changed'
