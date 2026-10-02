---
paths: ["src/shared/**"]
---

# src/shared (adp-e-product)

- Any package imported here must be in the ROOT `package.json`, not only in a domain's: otherwise Jenkins breaks for
  every domain that uses shared (IFX-001). Checked by `check-shared-imports`.
- A shared change affects every domain: run `adp-domain-check` for the domains that use it before pushing.
