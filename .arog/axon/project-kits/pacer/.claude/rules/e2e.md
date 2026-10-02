---
paths: ["runner/dashboard/web/e2e/**", "runner/dashboard/web/src/**"]
---

# Dashboard tests (PACER)

- In Playwright e2e specs, `getByRole` and `getByText` use `{ exact: true }`: substring matching produced false passes.
- `npm run test` (vitest) covers only the pure functions in `lib/*.ts`; UI behaviour is tested only by `e2e/*.spec.ts`,
  which needs `npm run dev` running on port 3001.
