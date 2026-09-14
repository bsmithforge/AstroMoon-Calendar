# AstroMoon Calendar

[![CI](https://github.com/bsmithforge/AstroMoon-Calendar/actions/workflows/ci.yml/badge.svg)](https://github.com/bsmithforge/AstroMoon-Calendar/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-B89A62.svg)](LICENSE)

**Live at [astromoon.ca](https://astromoon.ca/)**

A Moon phase and zodiac calendar that computes everything in your browser: exact New, Quarter, and Full Moon times, tropical Moon sign ingresses to the second, solar and lunar eclipse peaks, and a daily noon Moon sign snapshot, all shown in the timezone you choose.

![AstroMoon masthead](public/og-image.jpg)

## Get it into your calendar

- **Subscribe (recommended).** Open **Subscribe** on the site to add a live `webcal://` feed to Apple Calendar, Google Calendar, Outlook, Fastmail, Proton, Thunderbird, or anything that accepts a calendar URL. It covers a rolling window (1 month back, 12 months ahead) and refreshes on its own, so it never runs out.
- **Download an ICS** for a one-time import of any date range.
- **Print a PDF**: whole-month calendar pages (A4, up to 24 months) or a data table for an exact range.

The feed is served by a small serverless function:

```
GET https://astromoon.ca/api/calendar?tz=America/Edmonton&hemi=northern&phases=1&ingresses=1&daily=0&eclipses=1
```

| Parameter | Values | Default |
| --- | --- | --- |
| `tz` | Any IANA timezone | `UTC` |
| `hemi` | `northern` \| `southern` (Moon illustration orientation) | `northern` |
| `phases`, `ingresses`, `daily`, `eclipses` | `1` \| `0` | `1` |

## How it's calculated

Positions come from [astronomy-engine](https://github.com/cosinekitty/astronomy) (VSOP87 / ELP2000-82), pinned to 2.1.19. The Moon's geocentric apparent ecliptic longitude is mapped onto the tropical zodiac (twelve equal 30° signs from the March equinox); ingress times are refined by bisection to a one-second bracket. The **Methodology** panel on the site compares computed times against published reference values. Traditional sign and phase interpretations are included for interest and are not predictions.

## Development

```
npm ci
npm run dev      # Vite on http://localhost:3000, also serves /api/calendar
npm test         # node test runner: ICS serialization, feed contract, runtime emulation
npm run lint     # tsc --noEmit
npm run build    # static build to dist/
```

Stack: React 19, TypeScript, Vite 6, Tailwind CSS 4, jsPDF. No database, no auth, no API keys. See [AGENTS.md](AGENTS.md) for the code map, domain rules, and conventions, and [CONTRIBUTING.md](CONTRIBUTING.md) if you'd like to send a change.

## Run your own

Fork it and import the fork into [Vercel](https://vercel.com/new) with the Vite preset. No environment variables are required; pushes to `main` deploy. The feed handler in `server/calendar.ts` is bundled by esbuild during `npm run build` and exposed through `api/calendar.js`, and `vercel.json` sets caching headers. The subscription URL is built from the page origin, so the feed works on whatever domain you deploy to.

Things you'll want to change for your own deployment:

- `index.html`: `<title>`, canonical URL, Open Graph / Twitter URLs, and the JSON-LD block
- `public/robots.txt` and `public/sitemap.xml`: site URL
- `public/og-image.jpg`, `public/masthead_banner.jpg`, `public/moon_engraving.jpg`: artwork
- `src/App.tsx`: the "Made by" footer link
- `src/utils/icsExport.ts` and `src/utils/subscription.ts`: calendar name and `PRODID`

Any static host works for the app itself. Only the live feed needs a serverless function; ICS download and PDF export run entirely in the browser.

## License

[MIT](LICENSE). Astronomical calculations use [astronomy-engine](https://github.com/cosinekitty/astronomy) (MIT). Sign and phase interpretations are traditional and offered for interest only.

Made by [Brody Smith](https://smiths-forge.ca/).
