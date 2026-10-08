# Deploy Astral on Render

[Deploy to Render](https://render.com/deploy?repo=https://github.com/iamsreecharan/Astrology_AI)

1. Open the link and sign in to Render.
2. Connect GitHub if asked, then select `iamsreecharan/Astrology_AI`.
3. Render reads `render.yaml`. Check that `astral-astrology-ai` uses the **Free** plan, then deploy.
4. Wait for the build and health check, then open the service URL Render provides. The cloud-onboarding screen does not provide a live preview.
5. Open **Birth chart** to inspect the labeled example, then save your own recorded birth details. Check the chart and periods, choose a topic, and try marriage, job, or married-life questions in **Ask Astral**.

For a direct readiness check, `/api/health` should return `{"status":"ok","service":"astral"}`.

The Blueprint installs locked dependencies including build tools, builds the React app, and starts the Node server. Node is pinned to the tested version. The server uses Render's `PORT` and listens on all interfaces. Calculations and the local guide need no database or AI key.

For an existing service, deploy the latest `main` commit from the dashboard, or check that automatic deployment picked it up.

## Enable Vedic AI

Add `ASTROLOGY_AI_API_KEY` in the service's **Environment** settings. Optionally set `ASTROLOGY_AI_MODEL`; the default is `gpt-4.1-mini`. Save and redeploy/restart. A working key, model access, and provider billing are required; the repository supplies no credential.

Save a complete birth profile and select **Vedic AI** in **Ask Astral**. Successful replies carry the **Vedic AI** label. Without a key, the **Calculated Vedic guide** works locally and **Enable live Vedic AI** explains setup. A date-only profile needs recorded birth details before live Vedic chat can run.

The existing model receives calculated chart facts, selected original notes, the question, and recent conversation. Raw profile fields are excluded from its structured context; personal details typed into messages can still be sent. The key stays on the server.

If a request fails, check the key, model access, and billing, or switch to **Local**. Cloud secrets and local `.env` files are separate from Render settings and do not transfer automatically. Keep keys out of Git and chat.

The service has no accounts or per-user AI quotas. Review access and usage controls before opening a paid-key deployment to a wider audience. See [privacy and hosting](../README.md#privacy-and-hosting).

## Troubleshooting

- Check the latest build and runtime logs without sharing credential values.
- If Vite is missing, check that the build command includes `npm ci --include=dev`.
- If health checks fail, check that the production build completed and the start command is `npm start`.
- A free service's first request may need time to start; retry once it is running.
- Chart errors usually need all birth fields supplied together, with the recorded time, coordinates, and historical IANA zone checked.

The production workflow was checked in the Codex environment. A live Render URL is confirmed only after deployment in your account. See [calculation methods](VEDIC.md) for chart and timing limits.
