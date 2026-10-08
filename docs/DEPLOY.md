# Deploy Astral on Render

[Deploy to Render](https://render.com/deploy?repo=https://github.com/iamsreecharan/Astrology_AI)

1. Open the link and sign in to Render.
2. Connect GitHub if asked, then select `iamsreecharan/Astrology_AI`.
3. Render reads `render.yaml`. Check that `astral-astrology-ai` uses the **Free** plan, then deploy.
4. Wait for the build and health check, then open the service URL Render provides. The cloud-onboarding screen does not provide a live preview.
5. Enter the planetary welcome. AI Yogi offers **Personalize my astrology** to open your birth details, with **Skip for now** if you want to explore first. Type the birthplace and select the correct country and region to fill its coordinates and time zone. Open **Birth chart**, check the chart and periods, choose a topic, and try marriage, job, or married-life questions in **Ask Astral**. The example stays labeled until you supply your own profile.

For a direct readiness check, `/api/health` should return `{"status":"ok","service":"astral"}`.

The Blueprint installs locked dependencies including build tools, builds the React app, and starts the Node server. Node is pinned to the tested version. The server uses Render's `PORT` and listens on all interfaces. Calculations and the local guide need no AI key.

The build also generates Brotli and gzip text assets. Serve the complete `dist` directory through `npm start` to use them; no separate compression service is required. Files with content hashes use a year-long immutable cache, while HTML revalidates. Personal API responses remain uncached. Chart calculations start when the Birth chart page is opened, and Yogi pauses its 3D avatar outside the viewport.

Birthplace search reads the committed GeoNames SQLite snapshot with Node 24's built-in SQLite support. It needs no separate database, Python runtime, geocoding account, or external search request. Queries read the file on disk rather than loading the full catalogue into JavaScript memory, which keeps place search practical on the free service's 512 MB plan. See the [coverage and license](../server/data/README.md). The 3D welcome appears once per tab session, with immediate entry and skip controls. Its planets use perspective depth and visible motion on desktop, with Animate/Pause planets controls. Animation can be explicitly enabled in the welcome when the system prefers reduced motion; the background follows that preference after entry. The planetary background runs in the browser, becomes static for reduced-motion preferences, pauses while the page is hidden, and has a fallback when WebGL is unavailable.

For an existing service, deploy the latest `main` commit from the dashboard, or check that automatic deployment picked it up.

After saving a complete birth profile, **Birth chart → Download English PDF** creates the English birth record, Panchanga basics, chart diagrams, period tables, transits and life-topic assessments. Career planning includes individual DD-MM-YYYY dates with birth-star/Moon/tithi factors and near-term application/interview periods. PDF generation uses bundled fonts and the calculation engine, so it needs no AI key, external document service, or writable server storage. The downloaded file includes personal birth details.

**Compatibility → Kundali matching** accepts two complete birth profiles and calculates the eight Ashta Koota categories out of 36. Each person has worldwide birthplace suggestions, with a manual location option. The result includes the traditional benchmark, full/partial/zero-point category counts and an English matching PDF. It works without an AI key, extra service or persistent storage. Deploy the latest `main` revision to make the new tab and PDF routes available.

## Enable Vedic AI


Add `ASTROLOGY_AI_API_KEY` in this Render service's **Environment** settings. Optionally set `ASTROLOGY_AI_MODEL`; the default is `gpt-4.1-mini`. Save and redeploy/restart so the Node process receives the setting. A working key, model access, and provider billing are required; the repository supplies no credential.

After the server restarts, check the connection again in **Ask Astral** and save a complete birth profile. **Vedic AI** is selected automatically when configured; **Local** is the second option. Successful replies carry the **Vedic AI** label. Without a configured key, the **Calculated Vedic guide** works locally and **Set up live Vedic AI** explains setup. A date-only profile needs recorded birth details before live Vedic chat can run. Short replies answer the question first; **Calculation details** holds the supporting factors, windows, and references.

The existing model receives calculated chart facts, selected original notes, the question, and recent conversation. Raw profile fields are excluded from its structured context; personal details typed into messages can still be sent. The key stays on the server.

**AI Yogi** uses that same key for general or chart-based conversation, transcription, and natural male speech using `onyx`. The audio defaults are `gpt-4o-mini-transcribe` and `gpt-4o-mini-tts`; optional overrides are `ASTROLOGY_AI_TRANSCRIBE_MODEL` and `ASTROLOGY_AI_TTS_MODEL`. Confirm that your provider account has access to all three models. General questions work without a profile; personal readings use the saved birth profile, never the demonstration chart.

Open the deployed HTTPS URL, choose **AI Yogi → Start conversation**, and allow microphone access. Starting the conversation enables sound for later replies. It listens, transcribes, automatically speaks the visible answer, and listens again. Auto uses English by default and detects the current spoken question afresh on every turn; a selected language takes precedence. Each answer retains its own language for speech and replay. Changing the picker cancels obsolete requests and resumes active listening with the new selection. **End conversation** or Close stops the session. The microphone pauses while answers are generated and played. Hiding the page stops the session until you resume. Audio is forwarded to OpenAI without being saved by the app. Typed questions and written answers remain available when microphone or audio access fails.

If the setup notice remains after adding a key, confirm that it was added to the Render service serving the page and that the service restarted. `/api/config` should report `"aiEnabled":true`; this checks whether the running server has a key, not whether the provider accepts it. If a live request fails, check model access and billing, or switch to **Local**. Codex cloud secrets and local `.env` files are separate from Render settings and do not transfer automatically. Keep keys out of Git, browser code, and chat; troubleshoot names and status without sharing values.

The service has no accounts or per-user AI quotas. Review access and usage controls before opening a paid-key deployment to a wider audience. See [privacy and hosting](../README.md#privacy-and-hosting).

## Troubleshooting

- Check the latest build and runtime logs without sharing credential values.
- If Vite is missing, check that the build command includes `npm ci --include=dev`.
- If health checks fail, check that the production build completed and the start command is `npm start`.
- A free service's first request may need time to start; retry once it is running.
- For voice, allow microphone access on the HTTPS service URL. If text chat works but speech fails, check access and billing for the transcription and speech models. A denied microphone can be reset in the browser's site permissions.
- If a birthplace is missing, use the manual location fields. The bundled snapshot covers cities, towns, and many small settlements, rather than every address or village.
- Chart errors usually need all birth fields supplied together, with the recorded time, coordinates, and historical IANA zone checked.

The production workflow was checked in the Codex environment. A live Render URL is confirmed only after deployment in your account. See [calculation methods](VEDIC.md) for chart and timing limits.
