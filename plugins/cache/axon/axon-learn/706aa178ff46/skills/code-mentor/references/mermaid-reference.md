# Mermaid Reference for Simple Code Mentor

## Safe Mermaid rules

- Use `flowchart TD`.
- Use simple node labels.
- Use `A[Action]` for actions.
- Use `B{Question?}` for decisions.
- Use `-- Yes -->` and `-- No -->` for condition paths.
- Keep one diagram per fenced code block.
- Do not nest Mermaid inside another fenced block.

## Color classes

```mermaid
flowchart TD
    A[Action]
    B{Decision?}
    C[Success]
    D[Error]
    E[Existing / Refresh]
    F[New / Create]

    classDef action fill:#DBEAFE,stroke:#2563EB,color:#111827,stroke-width:2px;
    classDef decision fill:#FEF3C7,stroke:#D97706,color:#111827,stroke-width:2px;
    classDef success fill:#DCFCE7,stroke:#16A34A,color:#111827,stroke-width:2px;
    classDef error fill:#FEE2E2,stroke:#DC2626,color:#111827,stroke-width:2px;
    classDef existing fill:#EDE9FE,stroke:#7C3AED,color:#111827,stroke-width:2px;
    classDef newsetup fill:#FFEDD5,stroke:#EA580C,color:#111827,stroke-width:2px;

    class A action;
    class B decision;
    class C success;
    class D error;
    class E existing;
    class F newsetup;
```
