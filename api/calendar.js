// Vercel function entry. The handler is bundled by `npm run build` (scripts/build-api.mjs).
export { GET, HEAD } from '../server/dist/calendar.js';
