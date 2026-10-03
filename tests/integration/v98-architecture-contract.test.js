const assert=require('assert');
const fs=require('fs');
const path=require('path');

const root=path.join(__dirname,'../..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

const app=read('js/app.js');
const html=read('index.html');
const sw=read('sw.js');
const version=read('config/version.js');
const bootstrap=read('js/bootstrap.js');

const runtimeModules=[
  'js/domain/goals.js',
  'js/domain/study-logs.js',
  'js/domain/execution.js',
  'js/domain/analytics.js',
  'js/domain/calendar.js',
  'js/services/timer-service.js',
  'js/services/execution-service.js',
  'js/data/normalization.js',
  'js/data/migrations.js',
  'js/data/repository.js',
  'js/data/persistence.js',
  'js/application/orchestrator.js',
  'js/ui/pages/dashboard-page.js',
  'js/ui/pages/goals-page.js',
  'js/ui/pages/execution-page.js',
  'js/ui/pages/analytics-page.js',
  'js/ui/pages/calendar-page.js'
];

for(const file of runtimeModules){
  const script='./'+file;
  assert(
    html.includes(script),
    `index.html missing ${script}`
  );
  assert(
    sw.includes(script),
    `sw.js missing ${script}`
  );
  assert(
    html.indexOf(script)<html.indexOf('./js/app.js'),
    `${script} must load before app.js`
  );
}

assert(
  html.indexOf('./js/bootstrap.js')>html.indexOf('./js/app.js'),
  'bootstrap must load after app.js'
);

assert(
  !app.trimEnd().endsWith('renderAll();'),
  'app.js must not self-render at file end'
);

assert(
  bootstrap.includes("window.renderAll()"),
  'bootstrap must own initial render'
);

assert(
  bootstrap.includes("window.__goalManagerBooted"),
  'bootstrap must guard against duplicate boot'
);

assert(
  app.includes("const KEY='lawLangGoalSystemV92'"),
  'primary persistent key changed'
);

assert(
  app.includes("const BACKUP_KEYS=['lawLangGoalSystemV92_backup1','lawLangGoalSystemV92_backup2','lawLangGoalSystemV92_backup3']"),
  'backup keys changed'
);

assert(
  version.includes("GOAL_MANAGER_SCHEMA_VERSION=6"),
  'schema version changed'
);

const requiredDelegations=[
  'GoalDomain.',
  'StudyLogDomain.',
  'ExecutionDomain.',
  'AnalyticsDomain.',
  'CalendarDomain.',
  'TimerService.',
  'ExecutionService.',
  'DataNormalization.',
  'DataMigrations.',
  'DataRepository.',
  'DataPersistence.',
  'AppOrchestrator.',
  'DashboardPage.',
  'GoalsPage.',
  'ExecutionPage.',
  'AnalyticsPage.',
  'CalendarPage.'
];

for(const token of requiredDelegations){
  assert(
    app.includes(token),
    `app.js missing delegation ${token}`
  );
}

console.log('OK: V98 architecture runtime contract');
