# Bloodwork Visualizer

## What This App Does
A personal health data visualization tool. Users upload bloodwork results
(CSV or JSON), which are parsed, stored in localStorage, and displayed as
interactive charts, graphs, and tables. Users can filter by date range,
panel, and marker to explore trends over time.

## Tech Stack
- Pure static HTML/CSS/JS — no build tools, no npm, no framework
- Chart.js (CDN) for data visualization
- QUnit (CDN) for tests, in /tests/index.html
- localStorage for persistence (storage layer abstracted in js/storage.js)

## Project Structure
```
/
├── index.html
├── style.css
├── assets/
├── js/
│   ├── app.js        ← entry, wires modules together
│   ├── storage.js    ← all localStorage access lives here only
│   ├── parser.js     ← CSV + JSON ingestion + normalization
│   ├── charts.js     ← Chart.js wrapper + chart rendering
│   └── ui.js         ← DOM, filters, UI state
├── tests/
│   ├── index.html    ← QUnit test runner page
│   ├── parser.test.js
│   └── storage.test.js
└── CLAUDE.md
```

## Data Model
Every bloodwork reading is stored as a flat record:
```json
{
  "id": "uuid",
  "date": "YYYY-MM-DD",
  "panel": "string",
  "marker": "string",
  "value": number,
  "unit": "string",
  "referenceMin": number | null,
  "referenceMax": number | null,
  "status": "normal" | "low" | "high" | "unknown",
  "source": "string"
}
```
Storage key: `bloodwork_records` → JSON array of records.

## Development Rules
- **TDD**: Write tests in /tests/ before implementing features
- **Gitflow**: branch from `develop`, name branches `feature/short-name`
- **Commit often**: small, focused commits with clear messages
- **Relative paths only**: all asset/script paths must be relative (GitHub Pages)
- **No localStorage access outside storage.js**: keeps security layer isolated
- **No inline styles**: all styling in style.css
- **Modules via ES modules** (`type="module"` in HTML script tags)

## Git Workflow
- `main` → production, served by GitHub Pages
- `develop` → integration branch
- `feature/xxx` → feature work, branched from develop
- Merge feature → develop when done; develop → main to release

## Deployment
GitHub Pages, served from main branch root.
URL pattern: https://[username].github.io/[repo-name]/
All paths must work from a subdirectory — use relative paths.

## Lab Format Adapters
parser.js should support a pluggable adapter pattern. The canonical import
format is the normalized CSV defined in CLAUDE.md. Future adapters:
- Quest Diagnostics PDF export
- LabCorp export
- Apple Health XML

## Security Note
localStorage stores plaintext. The storage.js abstraction exists so
encryption can be added later without touching other modules. Do not
read/write localStorage anywhere else in the codebase.