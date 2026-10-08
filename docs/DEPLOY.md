# Deploy Astral on Render

[Deploy to Render](https://render.com/deploy?repo=https://github.com/iamsreecharan/Astrology_AI)

1. Open the deployment link and sign in to your Render account, or create one.
2. Connect GitHub if Render asks, and select `iamsreecharan/Astrology_AI`.
3. Render reads `render.yaml`. Review the `astral-astrology-ai` web service and confirm that the plan is **Free**, then deploy it.
4. Wait for the build and health check to pass. Open the service URL provided by Render. That is the live app URL; the Codex cloud-onboarding screen does not provide a live app preview.
5. Check the Today reading, save a profile, explore compatibility, and send a local question. For a direct health check, open `/api/health` on the Render service URL and expect `{"status":"ok","service":"astral"}`.

The Blueprint installs the locked dependencies including build tools, builds the React app, starts the Node server, and checks `/api/health`. Node is pinned to the tested version. The app listens on Render's injected `PORT` and all interfaces. No database or key is needed for these features.

## Optional live AI on Render

In the Render service's **Environment** settings, add your `ASTROLOGY_AI_API_KEY` securely. Optionally set `ASTROLOGY_AI_MODEL`; it defaults to `gpt-4.1-mini`. Save the settings and redeploy/restart the service.

Select **AI** in Ask Astral. A successful response must be labeled **AI reflection**. If the provider rejects the request, check the key, model access, and provider billing, or switch back to **Local**. Cloud onboarding secrets and a local `.env` are separate from Render's environment settings; they are not automatically transferred.

Never add API keys to this repository or paste them in chat. The app sends the question and sun sign to OpenAI; it keeps the key on the server and does not send profile names or birth dates.

## If the deployment fails

- Read Render's latest build and runtime logs. Do not post credential values.
- If Vite is missing, confirm that the build command includes `npm ci --include=dev`.
- If the health check fails, confirm the start command is `npm start` and that a production build completed.
- If the first request is slow, wait for the free service to start and retry.

The configuration and production workflow were checked in the Codex environment. Actual Render provisioning and the live URL are confirmed only after deployment in your Render account.
