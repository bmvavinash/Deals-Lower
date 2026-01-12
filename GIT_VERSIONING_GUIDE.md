# Git Versioning Guide

## Current Status
- **Current Branch**: `get-all-details`
- **Repository**: Initialized with existing changes

## Recommended Branch Structure

### Feature Branches to Create:

1. **`feature/telegram-bot-deduplication`**
   - `services/telegramDeduplicationService.js` (NEW)
   - `dataSources/autoTelegramAll.js` (modified)
   - Related Telegram bot deduplication fixes

2. **`feature/amazon-fallback-fix`**
   - `scrappers/amazon.js` (modified - fallback to avinashbmvINR)
   - `scheduler.js` (modified - fallback to avinashbmvINR)

3. **`feature/bulk-update-telegram-integration`**
   - `run_bulk_updates.js` (NEW - redirects to Telegram bot)
   - `run_telegram_bot.js` (NEW)

4. **`feature/telegram-bot-queue-fixes`**
   - Queue race condition fixes
   - Message processing improvements

## Git Commands to Execute

### Step 1: Create and switch to feature branch for Amazon fallback
```bash
git checkout -b feature/amazon-fallback-fix
git add scrappers/amazon.js scheduler.js
git commit -m "Fix: Assign Amazon fallback links to avinashbmvINR instead of avinashbmv"
```

### Step 2: Create and switch to feature branch for Telegram deduplication
```bash
git checkout get-all-details
git checkout -b feature/telegram-bot-deduplication
git add services/telegramDeduplicationService.js dataSources/autoTelegramAll.js
git commit -m "Feature: Add persistent deduplication service for Telegram bot"
```

### Step 3: Create and switch to feature branch for bulk update integration
```bash
git checkout get-all-details
git checkout -b feature/bulk-update-telegram-integration
git add run_bulk_updates.js run_telegram_bot.js
git commit -m "Feature: Integrate bulk updates with Telegram bot - auto-redirect after completion"
```

### Step 4: Create and switch to feature branch for queue fixes
```bash
git checkout get-all-details
git checkout -b feature/telegram-bot-queue-fixes
git add dataSources/autoTelegramAll.js
git commit -m "Fix: Resolve queue race condition in Telegram bot message processing"
```

## Current Modified Files (Not Staged)

These files have been modified but not yet staged:
- `config/constants.js`
- `dataSources/autoTelegramAll.js` (already in deduplication branch)
- `dataSources/handleProductProcessing.js`
- `index.js`
- `scheduler.js` (already in fallback branch)
- `scrappers/amazon.js` (already in fallback branch)
- `scripts/bulkUpdateAllPlatforms.js`
- `services/idleProcessingService.js`
- `utils/commonUtils.js`

## New Files (Untracked)

- `CHANGES_SUMMARY.md`
- `TELEGRAM_BOT_FIXES_SUMMARY.md`
- `services/telegramDeduplicationService.js` (NEW service)
- `run_bulk_updates.js` (NEW)
- `run_telegram_bot.js` (NEW)
- Various other new files

## Recommendation

1. **Review changes** in each file before committing
2. **Create separate branches** for each feature/fix
3. **Test each branch** independently before merging
4. **Keep main/master branch** stable
5. **Use descriptive commit messages**

## Testing Before Committing

1. Test Telegram bot with deduplication
2. Test Amazon fallback link assignment
3. Test bulk update → Telegram bot flow
4. Verify no breaking changes



