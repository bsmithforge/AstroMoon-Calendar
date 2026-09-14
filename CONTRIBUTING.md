# Contributing

Thanks for your interest. AstroMoon is a small, dependency-light project; contributions that keep it that way are welcome.

## Setup

```
npm ci
npm run dev
```

Node 20+ and npm. No API keys or `.env` file are needed.

## Before opening a pull request

```
npm run lint    # tsc --noEmit
npm test        # ICS serialization, feed contract, function runtime
npm run build   # static app + bundled feed function
```

CI runs the same three commands. [AGENTS.md](AGENTS.md) documents the code map, domain rules (timezones, ingress boundaries, export limits), design tokens, and the hosting constraints that are easy to break by accident — read the relevant section before touching astronomy, exports, or `api/`.

## What makes a good change

- Keep calculations in the browser. Don't add databases, paid APIs, or background services.
- Exports (ICS, feed, PDF) are the core feature. Verify generated files, not just that a download fired.
- Everything must work on a phone. Check 320–430 px widths for UI changes.
- Accuracy claims need a reference. If you change benchmark data or methodology copy, cite the source and its time scale.
- Small, focused PRs with a short description of what changed and how you checked it.

## Reporting issues

Open a GitHub issue with the timezone, date range, and view/export involved. For calculation discrepancies, include the reference value and where it came from.
