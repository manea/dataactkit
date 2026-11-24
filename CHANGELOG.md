# Changelog — DataActKit

All notable changes to this project will be documented in this file.

## [0.5.0] - 2026-11-24 — Public MIT Open-Source Release (`v0.5.0`)
### Added
- Public MIT open-source release assets: [`LICENSE`](LICENSE), GitHub Actions CI workflow (`.github/workflows/ci.yml`), 6 verified desktop/mobile screenshot showcase in [`docs/screenshots/`](docs/screenshots/), and updated [`README.md`](README.md).

## [0.4.0] - 2026-11-24
### Added
- `Playwright Chrome E2E` suite (`playwright.config.ts` & `tests/e2e/dataactkit.spec.ts` on `:4218`) verifying desktop (`1280×800`) and mobile (`390×844`) viewports in both `EN LTR Brussels Drafting Vellum` and `AR RTL Interconnect Slate Night`, preset switching, live `EUR 7,108` lock-in remediation to `100/100`, atomic `DA-YYYY-0001` sealing, `UTF-8 BOM` CSV download (`EF BB BF`), `/r/:code` public sharing, and `localStorage` persistence.
- Visual QA fixes across mobile header accessible labels, date field alignment, dark-theme badge contrast, Arabic BiDi isolation, and clean non-sticky layout framing.
- Zero-cost `$0` deployment & privacy-checked open-source preparation bundle (`wrangler.jsonc`, `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `deploy/*`, `launch/DEPLOY-AND-SHARE.md`, `README.md`).

## [0.3.0] - 2026-11-24
### Added
- Bilingual (`EN LTR / AR RTL`) `React 19 + Vite + Tailwind v4` interactive web UI (`Brussels Drafting Vellum` light & `Interconnect Slate Night` dark themes):
  - `DataActClockAndFeeSvg.tsx`: pure responsive `SVG` Art. 25 switching timeline bar + Art. 29 egress fee vs statutory limit comparison.
  - `ScopeAndClockPanel.tsx`: role/scope selector, `2026-09-12` Art. 3 IoT activation badge, Art. 25 notice/transition/14wd-infeasibility/retrieval controls, and saved organization profile manager.
  - `EgressAndControlsPanel.tsx`: Art. 29 switching/egress calculator (`pre-2027 direct cost cap` vs `2027-01-12 EUR 0 ban`) and interactive 7-control EU Data Act checklist.
  - `BatchVendorCsvPanel.tsx`: multi-vendor CSV batch importer, live per-vendor audit results, and formula-injection-safe `UTF-8 BOM` CSV download.
  - `DossierPreviewAndPrint.tsx` & `/r/:slugOrCode` public report viewer with dual `SQLite WAL` / `$0 localStorage` persistence, atomic `DA-YYYY-0001` sealing, `SHA-256` fingerprint, `A4 PDF` print sheet, and prominent non-legal-counsel disclaimer.

## [0.2.0] - 2026-11-24
### Added
- Bilingual Markdown readiness dossier exporter (`src/core/briefBuilder.ts`: `buildDataActBriefMarkdown`) in English and Arabic with mandatory non-legal-counsel disclaimer.
- Optional zero-dependency `Node 22` HTTP server & persistent `node:sqlite` (`WAL`) storage layer (`server/db.mjs`, `server/app.mjs`, `server/index.mjs`, `server/app.d.mts`) supporting `BASE_PATH=/dataactkit` and port `:4217`.
- Atomic immutable dossier sealing (`DA-YYYY-0001`), canonical `SHA-256` verification, `409 DOSSIER_LOCKED / ALREADY_LOCKED` immutability guards, vendor profiles CRUD, stateless switching/egress/CSV/assessment endpoints, `UTF-8 BOM` safe CSV export, `/summary`, `/brief.md`, public sharing (`/api/public/reports/:slugOrCode`), `413` body cap, and `429` write rate limiting.
- Server API & SQLite integration test suite (`tests/unit/dataActServer.test.ts`).

## [0.1.0] - 2026-11-24
### Added
- Zero-dependency EU Data Act (`Regulation (EU) 2023/2854`) deterministic core engine (`src/core/*`):
  - Art. 25 contractual cloud switching clock engine (`<= 2 months` notice, `30 days` standard transition or `<= 210 days` (`7 months`) exception with `<= 14 working days` infeasibility notice, `>= 30 days` retrieval).
  - Art. 29 switching & egress charge calculator enforcing the pre-`2027-01-12` direct technical cost cap and the mandatory `2027-01-12` `0 EUR` ban.
  - Art. 3 connected IoT access-by-design (`2026-09-12`) and Art. 25/26/28/29/30 control evaluator.
  - Multi-vendor CSV batch auditor with RFC 4180 parsing and formula-injection-safe `UTF-8 BOM` exporter.
  - Canonical SHA-256 dossier digest helper (`globalThis.crypto.subtle`) and three scenario presets.
  - Non-legal-counsel & non-EU-Data-Coordinator mandatory disclaimer.
