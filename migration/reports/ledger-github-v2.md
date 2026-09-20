# Ledger GitHub migration v2
- GitHub-native static app: apps/ledger/
- No AppDeploy API/database dependency
- Keeps 6 categories, allowance cycles, allowance/self-paid split, recurring rules, history
- Full JSON export/import
- Import validates transaction split and snapshots current GitHub data before overwrite
- Personal migration JSON stays ignored from public repo
