# Working on AstroMoon Calendar

## Project and setup

AstroMoon Cal is a client-side lunar calendar and almanac. It shows Moon phases, tropical zodiac positions and ingresses, global eclipses, and traditional interpretations, with calendar, timeline, year, ICS, and PDF views.

**Product priorities:** Exports are the main feature. Reliable, accurate, usable downloaded calendars and PDFs take priority when evaluating changes. The entire app must be fully mobile compatible, including export configuration and file delivery. Existing mobile issues are cleanup work to address in a dedicated task, not evidence that mobile support is optional or already complete.

- Stack: React 19, TypeScript, Vite 6, Tailwind CSS 4 via `@tailwindcss/vite`, Lucide icons, and `astronomy-engine` pinned to **2.1.19**. PDF exports use jsPDF and, for calendar images, `html-to-image`.
- There is no database, authentication, or third-party API integration. The only server code is the stateless subscription feed in `api/`; everything else runs in the browser.
- `package.json` and `package-lock.json` are the dependency sources of truth. Use npm; do not introduce another package manager's lockfile. Node 20+ is required (`engines`).

| Command | Purpose |
| --- | --- |
| `npm ci` | Install existing locked dependencies |
| `npm run dev` | Start Vite on port 3000 (also serves `api/` via the dev plugin) |
| `npm run lint` | Run `tsc --noEmit`; this is type checking, not ESLint |
| `npm test` | Node test runner over `tests/*.test.ts` (ICS serialization, subscription feed) |
| `npm run build` | Build the static app into `dist/` |
| `npm run preview` | Serve the built app locally (no `api/`) |

There is no formatter configuration or CI workflow. A successful Vite build does not replace the separate type check.

The app needs no API keys or `.env` file to run. The `@/` alias resolves to the repository root, not `src/`.

## Hosting and GitHub workflow

The app is deployed on **Vercel** (Vite preset; static `dist/` plus serverless functions in `api/`), with the repository on **GitHub**. Pushes to `main` deploy. Keep implementation choices appropriate to a free-tier budget.

- `api/` holds Vercel Node functions using the Web-standard `Request`/`Response` signature. During `npm run dev`, the plugin in `vite.config.ts` mounts them at the same paths, so `/api/calendar` works locally without `vercel dev`. `vite preview` does not serve them.

- Prefer small improvements within the current browser-based React/Vite architecture. Keep infrastructure, dependencies, and ongoing maintenance modest; introduce services or major architectural changes only when the requested feature warrants them.
- Keep ordinary calendar calculations and exports local to the browser. Avoid adding paid APIs, databases, background services, or another hosting platform as incidental requirements.
- Watch bundle size, repeated astronomy calculations, and memory use during PDF capture. Use bounded ranges, reuse computed data where practical, and retain lazy loading for export libraries.
- Do not add custom deployment infrastructure merely to support routine app changes.
- Deliver source/configuration changes through the existing GitHub workflow. Keep generated output, local environment files, and secrets out of commits.

## Code map

| Location | Responsibility |
| --- | --- |
| `src/main.tsx` | React entry point, StrictMode, global CSS |
| `src/App.tsx` | Navigation, filters, modal state, memoized datasets, URL/title synchronization |
| `src/types.ts` | Shared `AstroRecord`, `DayLunarData`, `FilterSettings`, phase and zodiac contracts |
| `src/utils/astronomy.ts` | Timezone conversion, lunar calculations, event searches, range/month datasets, record filtering |
| `src/utils/zodiac.ts` | Twelve tropical signs, longitude-to-sign mapping, traditional descriptions |
| `src/components/CalendarGrid.tsx` | Monday-first month grid, blank adjacent-month slots, day selection |
| `src/components/TimelineView.tsx` | Filtered event feed |
| `src/components/YearOverview.tsx` | Annual new/full Moon and eclipse overview, using shared event search helpers |
| `src/components/ControlPanel.tsx` | Month navigation, range presets, timezone, hemisphere, event toggles |
| `src/components/DayDetailModal.tsx` | Noon snapshot, exact events, single-day ICS download |
| `src/components/ExportModal.tsx` | Export ranges/toggles, downloads, off-screen calendar capture |
| `src/utils/icsExport.ts` | ICS serialization and browser download |
| `src/utils/subscription.ts` | Webcal feed contract: query parsing/building, rolling window, feed payload, add-to-calendar links |
| `api/calendar.ts` | Vercel serverless function serving the live subscription feed (`GET /api/calendar`) |
| `src/utils/icsFormatting.ts` | Shared ICS titles and multiline notes, selected-timezone labels, hemisphere-aware quarter emojis |
| `src/utils/pdfExport.ts` | Vector data-table PDF and image-based calendar PDF |
| `src/components/MoonVisual.tsx` | SVG illumination geometry and hemisphere orientation |
| `src/utils/validationData.ts` | Static benchmark display data used by `MethodologyModal` |
| `src/index.css` | Palette, font utilities, SVG sizing safeguards, print rules |
| `index.html`, `public/` | Initial HTML content, SEO metadata, fonts, public images, robots/sitemap, standalone 404 |

`generateRangeDataset()` produces `days` and `records`; `generateMonthData()` wraps it to create padded month grids. Keep astronomical calculations in the utilities and use the shared types. `Header` calculates the current Moon directly through shared helpers. `YearOverview` uses the quarter/eclipse search helpers directly rather than generating daily snapshots.

## Domain rules to preserve

- Timed events carry absolute instants in `utcTime`. `localDateString` and displayed times refer to the selected IANA timezone. Use `getUtcForLocalTime()` and `getLocalDateComponents()` instead of relying on the browser's timezone or parsing a bare date as a local instant.
- Daily signs and phases are snapshots at **12:00 local time**. They are distinct from exact quarter, ingress, and eclipse events. Phase category windows in `getMoonPhaseInfo()` do not determine exact quarter times.
- App/month-grid month indexes are **0–11**. Timezone helper month arguments and URL `month` values are **1–12**. Date ranges use `YYYY-MM-DD` and are intended to include both endpoint dates.
- Zodiac positions use twelve equal 30-degree tropical sectors, with Aries at 0 degrees. Preserve normalization to `[0, 360)` and the Pisces-to-Aries wraparound. Ingress bisection narrows the bracket to at most one second; that numerical precision is not proof of empirical accuracy.
- Hemisphere selection changes Moon presentation, not the event instant, longitude, or illumination fraction. Check SVGs and emoji/text representations when modifying it.
- Eclipse records represent global peaks, separate from new/full Moon instants. Keep global occurrence distinct from local visibility. Label astrological themes as traditional interpretations.
- Despite its name, `showFullNewMoon` controls **all four primary quarters** in the shared record filter. Preserve consistent toggle semantics across consumers when changing filters.
- Keep calculations deterministic for their supplied dates/timezone and avoid adding expensive event searches inside per-cell rendering. Range generation is synchronous and can be costly for long intervals.

## Exports: primary product workflow

Treat the exported files as user-facing deliverables. Changes to dates, filters, event text, astronomy, typography, or the shared calendar can affect them even when the export utilities are untouched.

| Export path | Current flow |
| --- | --- |
| Range ICS | `ExportModal` local dates/toggles → `generateRangeDataset()` → `filterAstroRecords()` → `generateIcsPayload()` → Blob/object URL download |
| Live subscription | `ExportModal` toggles/timezone → `buildSubscriptionUrl()` → user subscribes to `webcal://…/api/calendar?…` → `api/calendar.ts` → `buildSubscriptionIcs()` (rolling window, day-pinned DTSTAMP, `REFRESH-INTERVAL`) → edge-cached `text/calendar` |
| Single-day ICS | `DayDetailModal` → all `day.events` (daily-summary fallback) → the same ICS serializer/download helper |
| Data-table PDF | The same filtered range records as range ICS → dynamically imported `generatePdfDocument()` → jsPDF `save()` |
| Calendar PDF (default PDF mode) | Months spanned by export dates → `generateMonthData()` → off-screen `CalendarGrid` with export toggles → PNG captures → `generateCalendarPdf()` → jsPDF `save()` |

The export dialog initializes its own dates and toggles from app state; export edits do not update the main calendar filters. Check initialization, reopening, and preset changes when modifying this workflow. ICS files are static, one-time imports, not subscriptions or a live calendar sync.

- ICS serializers accept already-selected records. Preserve CRLF endings, escaped text, UTF-8-safe folding at 75 bytes including continuation whitespace, UTC `Z` timestamps for timed events, and exclusive next-day `DTEND` for all-day events.
- Current ICS UIDs are `${rec.id}@astromooncal.app`. Preserve event identity when changing generation/serialization so repeated imports do not unexpectedly duplicate events. Timed events currently have a one-hour export duration.
- Both ICS callers pass the selected timezone and hemisphere to `generateIcsPayload()`. ICS presentation uses `icsFormatting.ts` without mutating shared records: short daily titles, coordinate details, noon snapshot labels, global eclipse visibility notes, and separate traditional interpretations. Keep escaped description line breaks and the final file CRLF intact.
- Data-table PDFs consume filtered records and use standard PDF fonts with text sanitization, fixed-height rows, truncation, repeated headers, and page numbering.
- Calendar PDFs capture off-screen `CalendarGrid` instances with `html-to-image`, one month per A4 page. They currently include whole months spanned by the selected range, capped at 24 months. Preserve the capture attributes `data-export-month` and `data-month-label`, and check both PDF modes after shared grid/export changes.
- Keep PDF/image dependencies dynamically imported from the export actions unless there is a concrete reason to change loading behavior.

When changing export behavior:

- Validate dates and range limits before any dataset or off-screen month generation, including while date fields are being edited. Surface calculation errors separately from an empty selection. Range ICS/table PDF currently reject zero records; calendar PDF has a different path and can still render grids with all event toggles off.
- Make the selected range, timezone, hemisphere, included event types, and output scope clear. The current whole-month expansion and 24-month cap belong only to calendar PDF; do not silently apply them to ICS/table output or present truncated output as a complete requested range.
- Preserve usable filenames, event identity, and readable event details. Compare ICS and table records for the same settings, and validate single-day export separately because it bypasses range toggles.
- Calendar capture uses a 900px-wide, inert off-screen container, `pixelRatio: 2`, `skipFonts: true`, a font readiness wait, a warm-up capture, and sequential month captures. `CalendarGrid` uses named container queries (`calendar`) so the capture always uses the full desktop layout regardless of the browser viewport. Preserve container-based breakpoints for all responsive grid content. Check fonts, SVGs, and layout in files generated from both mobile and desktop.
- Keep capture memory bounded. The current implementation retains every month's PNG until PDF assembly; do not raise range/resolution limits or parallelize all captures without evaluating phone memory and responsiveness. Off-screen content must remain renderable for capture while staying out of the interactive/accessibility flow.
- Keep generation state, duplicate-click protection, recoverable errors, and cleanup dependable. A success message after initiating a browser download is not proof that the user saved or imported the file. Verify actual file delivery when changing Blob URLs, asynchronous PDF actions, or download handling.

## Full mobile compatibility

Mobile is a required first-class experience across navigation, all views, filters, date/timezone inputs, every modal, and all export paths. Keep the feature set available on phones; hiding a control is not a mobile fix.

- Design for touch and narrow screens: readable text, comfortably tappable controls, wrapping labels, and no unintended page-level horizontal scrolling or clipped actions. Buttons allow wrapping globally; keep text-bearing controls and FAQ questions able to wrap.
- Preserve seven-column calendar alignment while keeping day selection usable. Essential information must be available through taps and accessible controls without relying on hover.
- Modals must fit the available viewport and scroll internally as needed. Keep close/download actions reachable with browser chrome, safe-area insets, orientation changes, and the on-screen keyboard. Preserve focus visibility, meaningful labels, and keyboard access.
- For relevant UI changes, check representative widths of 320, 375/390, and 430 CSS pixels, a tablet size, and desktop; include portrait and landscape. Exercise long timezone names, populated calendar days, export presets, custom dates, and modal scrolling.
- For export/download changes, validate iOS Safari and Android Chrome where available: configure an export, generate each PDF mode and ICS, save/open the actual files, and check legibility and contents. Responsive emulation is useful for layout but does not establish native file-download or calendar-import behavior; report any device/browser coverage gaps.
- Mobile improvements must also preserve printable PDFs. Check downloaded calendar output after changing shared grid typography, breakpoints, spacing, or SVG styles. Keep processing and image capture practical on phones as well as within the hosting constraints.

## UI and coding conventions

- Follow the surrounding functional React/TypeScript style: typed props, shared types, two-space indentation, and Tailwind utilities. Avoid unrelated formatting or dependency churn.
- Keep hooks unconditional and above early returns. Preserve StrictMode and use stable keys/unique SVG IDs for repeated calendars and export captures.
- Preserve the almanac design unless redesign is requested: parchment `#F3EDDF`, ink `#182421`, vermilion `#B44732`, brass `#B89A62`, sage `#657367`, and border `#D8D0BF`. Reuse the existing serif/sans font classes, `MoonVisual`, and Lucide icons.
- The header has Month/Timeline/Year navigation and a Learn disclosure for the zodiac guide and methodology. Event filters use labeled icon checkboxes; timezone and hemisphere controls live in the expandable Your sky section. Keep selected states understandable without color alone and all settings reachable by touch and keyboard. Learn closes on outside pointer/focus events; do not close it on blur alone, which can hide its buttons before a touch click is delivered.
- Maintain the seven-column calendar at small widths, keyboard day selection, readable labels, and print behavior. Shared grid styling also affects calendar PDFs.
- The calendar snapshot date range, noon time, and timezone are shown once above the displayed months. Day details show the full selected-day noon timestamp. Keep calendar date rows equal-height and Moon rows anchored at every container size, including when noon signs are off. The day modal masthead and details scroll together, with footer actions outside the scroll area.
- Visible images currently use `/masthead_banner.jpg` and `/moon_engraving.jpg` from `public/`; similarly named files in `src/assets/images/` are not the current component references.
- `index.html` includes static initial content replaced by React on mount. Keep it and SEO metadata aligned with relevant product changes. Production URLs are hardcoded in `index.html`, `public/robots.txt`, and `public/sitemap.xml`; changing `.env.example` alone does not update them.

## Known gaps: verify before building on them

These are observations from the source, not instructions to fix unrelated issues during every task.

- `DOCUMENTATION.md` describes intent but contains stale dependency versions, UID examples, PDF behavior, and verification claims. Verify behavior against code. `validationData.ts` stores computed timestamps and pass flags as constants; it does not run assertions or recompute benchmarks. Do not report those flags as tests you ran.
- `ExportModal` conditionally mounts a separate form component so each open initializes from app state with stable hook ordering. Export date validation precedes all export dataset generation; calendar PDFs reject ranges over 24 months, and ICS/table PDFs reject ranges over 3,660 inclusive days to bound synchronous calculation. Keep these limits distinct and visible.
- `generateRangeDataset()` has only basic date parsing checks and a loop that stops on an exact end-date string. Reversed or impossible dates can cause unbounded work. Validate real dates and ordering before introducing new range callers; inspect next-midnight inclusion when fixing range boundaries.
- Filter application is not fully centralized: the timeline duplicates filter logic, the grid reads flags directly, and year/day-detail views do not receive the full filter settings. Single-day ICS exports all of `day.events`. Account for these paths when changing filter behavior.
- Range dates stored in filters can diverge from month navigation. The combined record array is not globally sorted. Check navigation/range synchronization and chronological ordering when working on timeline or export behavior.

## Validation and handoff

For code changes, run `npm run lint`, `npm test`, and `npm run build` when the environment supports them. For documentation-only changes, check the diff and referenced paths/commands; no app build is necessary. Report checks actually run and any blockers without claiming unperformed verification.

Choose additional checks based on the change:

- **UI/state:** desktop and narrow mobile layouts; month navigation across December/January; month/three-month/year presets; all three views; day and export modal reopen behavior; individual toggles and all-off state; URL `?year=2026&month=3` and title updates.
- **Dates/astronomy:** leap day; range endpoints; UTC; Edmonton DST transitions; Kolkata fractional offset; Auckland date rollover; both hemispheres; ingress wraparound; distinct quarter and eclipse peak records. Add focused regression coverage for logic fixes where useful rather than treating static benchmark data as a suite.
- **Exports:** single-day and range ICS, Unicode folding, all-day end dates, both PDF layouts, multiple pages/months, timezone labels, filter selection, clipping, and legibility. Inspect generated files, not just download-success messages.
- **Accuracy claims:** recompute relevant values and check authoritative references and their time scales before changing benchmark data or claims. Keep methodology copy and technical docs aligned with verified behavior.

Keep changes scoped to the requested work. Update this guide when architecture, commands, or relevant constraints change, and summarize the result, validation, and material remaining limitations in the handoff.
