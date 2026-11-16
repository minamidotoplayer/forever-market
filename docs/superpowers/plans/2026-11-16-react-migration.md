# React TypeScript migration

Goal: preserve the fantasy auction design and all market features while replacing imperative DOM updates with typed React components.

Architecture: Vite serves a static React app. Python continues writing web/data. React hooks own abortable market requests and bounded item metadata requests. Pure pricing/search functions remain independently tested. Explicit localization replaces MutationObserver.

- [x] Add React/TypeScript/Vite and reproducible npm lockfile; relative deployment base.
- [x] Define domain types and migrate pure utilities/category catalogue.
- [x] Implement data/storage/metadata hooks with request cleanup.
- [x] Implement market pickers, category tree, filters, stable keyed table.
- [x] Implement SVG history, quantity quotes, basket, craft/recipe search, settings and CSV.
- [x] Run utility, DOM integration, Python, typecheck and build checks.
- [x] Update workflows to npm ci and verify static build assets.
- [ ] Publish and verify deployed assets.

Validation: integration tests must cover row identity after selection, combined filters, old local storage, and stale requests. No desktop/browser control is used.
