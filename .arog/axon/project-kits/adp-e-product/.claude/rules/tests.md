---
paths: ["tests/**", "src/**/*.spec.ts"]
---

# Tests (adp-e-product)

- Run scoped: `TEST_BUSINESS_DOMAIN=<domain> npx jest <path> --no-coverage`. Never plain `npm test`: it walks all 15
  domains.
- Tests under `tests/<domain>/events/<noun.verb>/` are 4 folders deep: `../../../../src/shared/...`. Three levels works
  locally and fails in Jenkins.
- `adp-domain-check` runs tsc and the domain suite for every domain the change touches.
