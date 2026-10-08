# Astral

A Vedic birth-chart and astrology chat app built with React, TypeScript, Vite, and Node/Express. The server calculates chart facts; a local guide or an optional language model explains them.

[Deploy to Render](https://render.com/deploy?repo=https://github.com/iamsreecharan/Astrology_AI) · [Deployment guide](docs/DEPLOY.md) · [Calculation methods](docs/VEDIC.md)

![Astral with an example birth profile](docs/preview.png)

The screenshot uses an example profile. Render creates a live URL after deployment; the cloud-onboarding screen does not provide an app preview.

## What it does

- Calculates approximate Lahiri sidereal D1 and D9/Navamsa placements, whole-sign houses, Moon rashi, nakshatra and pada, ascendant, mean Rahu/Ketu, and planetary motion.
- Shows Vimshottari birth balance, mahadasha/antardasha timelines, and current transits.
- Estimates traditional marriage windows with dates, completed-age ranges, and calculation reasons. It returns no window when the rules find none.
- Finds conditional career opportunity periods and tracks changes in Saturn's traditional Moon-relative phases.
- Explains married life, education, finances, family, travel, wellbeing, and general life themes using the relevant houses, rulers, and dasha periods.
- Answers chart questions with a **Calculated Vedic guide**, or **Vedic AI** when an OpenAI key is configured.
- Keeps Western calendar sun-sign daily reflections and compatibility available for date-only profiles.
- Saves profiles in the current browser, with controls to edit or remove them.

These are traditional chart interpretations and limited timing rules, not validated forecasts. A window does not promise a marriage, job, financial result, or an end to hardship. The [method notes](docs/VEDIC.md) explain each method.

## Run it

Use Node 24.5 or later within Node 24; `.nvmrc` pins the tested version.

```sh
npm ci
npm run dev
```

The app and API share port 3000, with hot reload in development. Set `PORT` or `HOST` to change the listening address.

For production:

```sh
npm run build
npm start
```

Build the assets before starting. The [Render Blueprint](docs/DEPLOY.md) runs this workflow without a database or separate calculation service.

## Add a birth profile

In the profile editor, enable **Add birth time and place for a Vedic chart**. Enter the date and recorded local birth time, then choose an Indian city preset or supply a custom place, numeric latitude/longitude, and an IANA zone such as `Asia/Kolkata`. The server applies historical time-zone rules.

Birth dates are supported from 1900 through today, and transits through 2100. Partial details and ambiguous or nonexistent daylight-saving times return an error instead of a guessed chart. If your recorded time is unknown, keep a basic profile for daily reflections and Western compatibility.

Open **Birth chart** for placements, periods, and the topic selector. In **Ask Astral**, try “When might I get married?”, “When could I find a job?”, “How does my chart describe married life?”, or “When does my current Saturn phase change?” Results from the labeled example profile are demonstrations.

## Enable Vedic AI

The calculated local guide works without credentials and does not use a language model. Live chat uses an existing OpenAI model grounded in the computed chart and selected original Jyotish notes. It is not custom-trained on all Vedic astrology.

Set `ASTROLOGY_AI_API_KEY` securely in cloud settings, Render's service environment, or a local ignored `.env` file. `ASTROLOGY_AI_MODEL` is optional and defaults to `gpt-4.1-mini`. Restart after changing settings. A valid key, model access, and provider billing are required; no key is included.

Live AI requires a complete birth profile. The server sends derived chart facts, selected notes, the question, and up to six recent conversation messages to OpenAI. It excludes the raw profile name, birth date/time, place, coordinates, and time zone from the structured model context. Personal information typed into messages can still be sent. The model explains supplied values rather than calculating planetary positions; topic assessments and timing windows come from the server's rules.

The key stays on the server. Node's `--use-env-proxy` supports the cloud platform's HTTPS proxy route; the cloud secret destination is `api.openai.com`. Keep keys out of browser code, Git, and chat. Provider errors stay visible, and Local mode remains available.

## Checks

```sh
npm run check
```

This runs TypeScript checking, the production build, and Node tests for profiles, Western reflections, chart positions, D9, Vimshottari, topic assessments, timing rules, knowledge selection, and the API. Chart tests use independent numeric reference fixtures. Timing tests check period boundaries, ages, transit integration, ranking, and no-window behavior; they do not validate real-life outcomes.

Provider tests use controlled responses to check grounding, conversation handling, privacy filtering, and failures without API charges. A real key must be verified separately.

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Service readiness |
| `GET /api/config` | Signs and AI availability; no credentials |
| `POST /api/profile` | Validate a profile |
| `POST /api/chart` | Calculate a chart from `{ profile }` |
| `POST /api/prediction` | Calculate a topic assessment from `{ profile, topic }` |
| `POST /api/chat` | Answer `{ profile, message, focus, mode, history }` |
| `POST /api/reading` | Create a local daily reflection |
| `POST /api/compatibility` | Reflect on two Western sun signs |

A full profile looks like this:

```json
{
  "name": "Alex",
  "birthDate": "1995-05-21",
  "birthTime": "10:30",
  "birthPlace": "Hyderabad, India",
  "latitude": 17.385,
  "longitude": 78.4867,
  "timeZone": "Asia/Kolkata"
}
```

Prediction `topic` accepts `marriage`, `career`, `difficult-periods`, `married-life`, `general`, `education`, `finances`, `family`, `travel`, or `wellbeing`. The returned shape depends on the topic: event-related windows, Saturn phase changes, or house and dasha themes.

Chat `focus` accepts `general`, `love`, `career`, or `wellbeing`; `mode` accepts `local` or `ai`. Optional `history` contains up to six `{ role: "user" | "assistant", content: "..." }` messages. The server uses the question and recent context to select a topic, recalculates charts, and ignores client-supplied chart data.

## Cloud setup

Use the existing `/workspace/Astrology_AI` checkout. Cloud tasks are already isolated; another Git worktree is unnecessary.

```sh
cd /workspace/Astrology_AI
npm ci --cache /workspace/.cache/npm --no-audit --no-fund
npm run check
npm run dev
```

This workspace needs the writable npm cache. Install and startup instructions are saved in the environment draft. Review and save them in settings, then publish to retain the prepared filesystem. Future tasks must start the process again. Saving configuration does not start a service or publish the environment, and cloud secrets do not transfer automatically to Render.

## Privacy and hosting

The application server does not persist profiles or conversations. Saved profiles stay in browser local storage until removed or cleared. Chat stays in page state and disappears on reload. Birth inputs reach the server for calculation; AI mode also sends derived context and conversation to OpenAI.

The hosted service has no account authentication or per-user AI quotas. POST requests have an in-memory limit of sixty per minute per connection IP; a hosting proxy may make visitors share that budget. Add suitable access and usage controls before enabling a paid key for a wider audience.

## Code layout

- `src/`: interface and styles.
- `server/astrology.mjs`: profiles, Western signs, and daily reflections.
- `server/vedic-chart.mjs`: sidereal charts, D9, periods, and transits.
- `server/vedic-timing.mjs`: marriage-window rules.
- `server/vedic-forecast.mjs`: career windows and Saturn phase changes.
- `server/vedic-life.mjs`: house-based life topics and dasha themes.
- `server/vedic-knowledge.mjs`: original notes and grounded chat context.
- `server/app.mjs`: API, provider integration, and frontend serving.
- `tests/`: calculation and HTTP tests.
