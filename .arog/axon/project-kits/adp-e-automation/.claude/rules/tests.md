---
paths: ["tests/**", "test-inputs/**", "page-objects/**", "controllers/**", "fixtures/**"]
---

# Tests (adp-e-automation)

- Run with `npm start` after setting `TAG`, `E_TESTS_ENV`, `E_TESTS_STATE` (and optionally `TestCaseID`) in `.env`.
  Never `npx playwright test` or `npm run test`: they skip `run.sh` (env loading, cleanup, TAG handling). A run opens
  real browsers against a shared environment: name the environment and the tags before starting it.
- Page objects plus controllers: read a similar test first and follow it; `test.describe()` with `test.step()`.
- Conversation flows: `findNextQuestion({ testData, conversation })`, with the intent key from `constants.intents`
  (`constant.ts`), not the raw intent text.
- Test data: `const json = (await loadJSON()) || defaultJSON`; new data goes in the matching `test-inputs/` folder;
  SSN, EIN and emails come from the helpers, never hard-coded.
- Standards: camelCase files and functions, PascalCase classes, UPPER_CASE constants, no `any`, single quotes, errors
  through `logger.error()`.
