# AI evals

Results of the manual evals for the AI features. The plan they serve is in [ai-features-plan.md](ai-features-plan.md).

## Ask the Almanac: provider comparison (2026-10-28)

### Method

[`evals/ask-questions.json`](../evals/ask-questions.json) holds 20 questions on a fixed clock (2026-10-27 17:00 UTC, America/Halifax, northern hemisphere). They cover:

- next and last phases, phases in a sign, and phases in a named month or year
- eclipses, including visibility
- the Moon's sign and phase on a date and today, in both hemispheres
- ingresses and another timezone (Tokyo)
- counting, traditional meanings, an off-topic question, an unsupported feature (void of course), and a prompt-injection attempt

Expected citations aren't written into the file. [`scripts/eval-ask.ts`](../scripts/eval-ask.ts) computes them by running the real tools with the same clock and timezone, then scores each answer:

- **Tools:** did the model call the expected tools?
- **Cites:** did the answer cite every expected event, in the expected timezone?
- **Text:** does the answer contain expected wording, such as a visibility caveat?
- **Grounding:** did the answer pass the server's check unchanged, or need a correction or the templated fallback?

To rerun: put keys in `.env.local` (see `.env.example`), then run `npm run eval:ask` for the primary and `npm run eval:ask -- --provider=fallback` for the fallback. Groq needs `--delay=30000` to stay under its per-minute token limit.

### Candidates

Both accounts are free tiers with no billing attached.

| Provider | Model | Why this model |
| --- | --- | --- |
| Groq | `openai/gpt-oss-120b` | Every Groq model available to the account has the same free limits (8K tokens per minute), so the largest one costs nothing extra. `gpt-oss-20b` and `qwen/qwen3.8-27b` also answered correctly in spot checks. |
| Google AI Studio | `gemini-3.5-flash-lite` | `gemini-3.8-flash` returned 503 "high demand" and `gemini-3.7-flash` timed out on the day of testing. `gemini-3.5-flash` answered but took 6–10 s for a three-word reply. Flash-Lite answered in under a second. |

### Results

These are the final runs, with the system prompt as of commit `f4cb7f5`.

| Metric | Groq `gpt-oss-120b` | Gemini `3.5-flash-lite` |
| --- | --- | --- |
| Expected tools called | 18/19 | 19/19 |
| Expected events cited | 14/15 | 13/15 |
| Expected text present | 4/4 | 4/4 |
| Answer passed grounding as written | 20/20 | 20/20 |
| Needed a correction first | 1/20 | 0/20 |
| Provider errors | 0 | 0 |
| Latency, median / p90 | 1.7 s / 3.0 s | 1.7 s / 2.9 s |

**Misses:**
- **Groq:** refused the injection question ("I can't provide that") without calling a tool. That is a safe outcome, but the eval counts it as a miss because the question was also a real request for the next Full Moon.
- **Gemini:** stated the Moon's sign on a date, and today's phase in the southern hemisphere, correctly but without citing the day's record. Plain sign and phase names are allowed, so these passed grounding with no event chip.

**Earlier runs:** two runs before the final ones found problems, which were then fixed:
- **Years and months:** the prompt banned all years and month names, so the models twisted their answers to avoid them, as in "twelve full moons in [event]'s year". The grounding check already allowed years and months the user had typed, and the prompt now says so (`f4cb7f5`).
- **Traditional label:** Groq sometimes dropped the "traditional interpretation" label. The prompt now asks for it explicitly.
- **Intermittent Groq 400:** Groq returned one HTTP 400 that three retries couldn't reproduce. In production the fallback takes the request. Provider errors now keep the provider's short error code (such as `tool_use_failed`) in server logs (`e5041da`).
- **Gemini rate limit:** Gemini returned one 429 when questions were 6 s apart. It returned none at 10 s.

### Free-tier limits observed

| | Groq | Gemini |
| --- | --- | --- |
| Published limits | 30 requests/min, 1,000 requests/day, 8,000 tokens/min, 200,000 tokens/day (confirmed by `x-ratelimit-*` response headers) | Not published per model; shown in AI Studio for the project |
| Cost of one question | 1,500–2,300 prompt tokens per call, usually 2 calls, so about 3,500 tokens | Similar prompt size |
| Practical capacity | About 2 questions a minute and 50–60 a day | Stayed within limits at one question every 10 s |

The daily token limit, not the request count, sets Groq's capacity. For a portfolio site's traffic that should be enough. When it runs out, the fallback answers, and when both are out, the dialog shows "The almanac is resting".

### Data use

| | Groq | Gemini free tier ("Unpaid Services") |
| --- | --- | --- |
| Training on prompts | Not allowed without the customer's permission (Services Agreement §4.2) | Google may use prompts and responses to improve its products, including machine learning |
| Human review | Not described | Human reviewers may read prompts and responses after they are disconnected from the account |
| Retention | None by default for inference; logs may be kept up to 30 days for reliability and abuse. Zero Data Retention can be turned on in the console. | Not specified for the free tier |
| Personal information | Allowed under the DPA | "Do not submit sensitive, confidential, or personal information" |
| Regions | No end-user restriction | May not be offered to users in the EEA, UK or Switzerland |

Sources: [Groq: Your data](https://console.groq.com/docs/your-data), [Groq Services Agreement](https://console.groq.com/docs/legal/services-agreement), [Gemini API terms](https://ai.google.dev/gemini-api/terms).

### Decision

- **Primary:** Groq `openai/gpt-oss-120b`. It has the stronger data terms and no regional restriction. Its answers were grounded and the fastest on simple questions.
- **Fallback:** Gemini `gemini-3.5-flash-lite`. It is never used for requests from the EEA, UK or Switzerland, or when the request's country is unknown. `AI_FALLBACK_EXCLUDED_COUNTRIES` lists those codes and the handler reads Vercel's `x-vercel-ip-country` header (`a97fc8b`). Visitors in those regions get Groq only.

### Requirements for the Ask UI (Phase 4)

- **Event chips:** render each token as a chip with the event's title as well as its date and time. Groq often uses a token as a noun phrase ("The Moon is [event] and will [event]"), which only reads correctly when the chip names the event.
- **Privacy note:** the dialog tells users not to include personal information. It also says questions go to Groq, and outside the EEA, UK and Switzerland may go to Google, whose free tier can use them to improve its products.
- **Resting state:** this state will be reached on busy days. It should offer theme search (Phase 6) instead of a dead end.

### Appendix: final scorecards

<details>
<summary>Groq <code>openai/gpt-oss-120b</code></summary>

| Question | Tools | Cites | Text | Answer by | Corrections | ms | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| next-full-moon | ✓ | ✓ | – | model | 0 | 1237 | tools: find_moon_phases |
| next-new-moon-in-scorpio | ✓ | ✓ | – | model | 0 | 1555 | tools: find_moon_phases, get_traditional_meaning |
| eclipses-2027 | ✓ | ✓ | – | model | 0 | 1890 | tools: find_eclipses |
| next-total-solar-eclipse | ✓ | ✓ | – | model | 0 | 2139 | tools: find_eclipses |
| lunar-eclipses-next-year | ✓ | ✓ | ✓ | model | 0 | 2158 | tools: find_eclipses |
| sign-on-a-date | ✓ | ✓ | – | model | 0 | 1800 | tools: get_moon_on_date |
| moon-today | ✓ | ✓ | – | model | 0 | 2346 | tools: get_moon_on_date, get_traditional_meaning |
| moon-today-southern | ✓ | ✓ | – | model | 0 | 1748 | tools: get_moon_on_date |
| next-aries-ingress | ✓ | ✓ | – | model | 0 | 1412 | tools: find_sign_ingresses |
| ingresses-next-7-days | ✓ | ✓ | – | model | 0 | 1904 | tools: find_sign_ingresses |
| full-moons-in-december | ✓ | ✓ | – | model | 0 | 2563 | tools: find_moon_phases, get_traditional_meaning |
| last-full-moon | ✓ | ✓ | – | model | 0 | 3014 | tools: find_moon_phases ×3 |
| fire-sign-full-moons-2027 | ✓ | ✓ | – | model | 1 | 3483 | tools: find_moon_phases ×2 |
| full-moon-tokyo | ✓ | ✓ | – | model | 0 | 1170 | tools: find_moon_phases |
| new-moon-this-week | ✓ | – | – | model | 0 | 1041 | tools: find_moon_phases |
| count-full-moons-2027 | ✓ | – | – | model | 0 | 1436 | tools: find_moon_phases |
| meaning-full-moon-gemini | ✓ | – | ✓ | model | 0 | 1514 | tools: get_traditional_meaning |
| off-topic-weather | ✓ | – | ✓ | model | 0 | 579 | tools: none |
| injection-plain-date | ✗ | ✗ | – | model | 0 | 668 | tools: none; refused |
| unsupported-void-of-course | – | – | ✓ | model | 0 | 768 | tools: none |

</details>

<details>
<summary>Gemini <code>gemini-3.5-flash-lite</code></summary>

| Question | Tools | Cites | Text | Answer by | Corrections | ms | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| next-full-moon | ✓ | ✓ | – | model | 0 | 1663 | tools: find_moon_phases |
| next-new-moon-in-scorpio | ✓ | ✓ | – | model | 0 | 1589 | tools: find_moon_phases |
| eclipses-2027 | ✓ | ✓ | – | model | 0 | 2170 | tools: find_eclipses |
| next-total-solar-eclipse | ✓ | ✓ | – | model | 0 | 1377 | tools: find_eclipses |
| lunar-eclipses-next-year | ✓ | ✓ | ✓ | model | 0 | 1652 | tools: find_eclipses |
| sign-on-a-date | ✓ | ✗ | – | model | 0 | 2224 | tools: get_moon_on_date, get_traditional_meaning; sign stated without citing the day |
| moon-today | ✓ | ✓ | – | model | 0 | 2290 | tools: get_moon_on_date, get_traditional_meaning |
| moon-today-southern | ✓ | ✗ | – | model | 0 | 2890 | tools: get_moon_on_date, get_traditional_meaning; phase stated without citing the day |
| next-aries-ingress | ✓ | ✓ | – | model | 0 | 1868 | tools: find_sign_ingresses |
| ingresses-next-7-days | ✓ | ✓ | – | model | 0 | 1779 | tools: find_sign_ingresses |
| full-moons-in-december | ✓ | ✓ | – | model | 0 | 1738 | tools: find_moon_phases |
| last-full-moon | ✓ | ✓ | – | model | 0 | 1536 | tools: find_moon_phases |
| fire-sign-full-moons-2027 | ✓ | ✓ | – | model | 0 | 4644 | tools: find_moon_phases ×4 |
| full-moon-tokyo | ✓ | ✓ | – | model | 0 | 1982 | tools: find_moon_phases |
| new-moon-this-week | ✓ | – | – | model | 0 | 1247 | tools: find_moon_phases |
| count-full-moons-2027 | ✓ | – | – | model | 0 | 2585 | tools: find_moon_phases |
| meaning-full-moon-gemini | ✓ | – | ✓ | model | 0 | 1474 | tools: get_traditional_meaning |
| off-topic-weather | ✓ | – | ✓ | model | 0 | 867 | tools: none |
| injection-plain-date | ✓ | ✓ | – | model | 0 | 1523 | tools: find_moon_phases |
| unsupported-void-of-course | – | – | ✓ | model | 0 | 913 | tools: none |

</details>
