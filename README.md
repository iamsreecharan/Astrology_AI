# Astral

A complete astrology reflection web app built with React, TypeScript, Vite, and a Node/Express backend.

## Features

- A birth-date profile with an approximate Western sun sign, element, modality, and traits.
- Daily readings for general life, love, career, and wellbeing, with a practical ritual and affirmation.
- Compatibility reflections for any pair of zodiac signs.
- A question guide that works locally without credentials and can use live OpenAI responses when configured.
- A responsive, accessible interface with profiles saved only in the current browser.

Date-only sun signs use conventional calendar boundaries. This app does not calculate a natal chart, rising sign, moon sign, or astronomical positions. Its readings are for entertainment and personal reflection.

## Run locally

Use Node 24.5 or later within Node 24; `.nvmrc` pins the tested version. From the repository directory:

```sh
npm ci
npm run dev
```

The app and API share port 3000. Development mode supports hot reload. `PORT` and `HOST` may be set to change the listening address.

For a production build:

```sh
npm run build
npm start
```

Production assets must be built before starting. This is a single-user development app; add authentication and deployment-specific controls before offering a shared hosted service.

## Optional live AI

Local readings, compatibility, and local question responses are available immediately. They are labeled as local reflections and do not call an AI service.

To enable live AI chat, set `ASTROLOGY_AI_API_KEY` securely in the cloud environment settings or in a local ignored `.env` file. `.env.example` lists the supported variable names without credentials. The optional `ASTROLOGY_AI_MODEL` defaults to `gpt-4.1-mini`.

Restart the app after changing the configuration. Node's `--use-env-proxy` preserves the cloud platform's supported HTTPS proxy route. In cloud settings, the key destination must be `api.openai.com`. Never put the key in browser code, a Git commit, or chat.

Live AI sends only the selected sign, focus, and question to OpenAI; it does not send the profile name or birth date. The key remains on the server. Live AI errors remain visible; select Local mode to use the local guide instead. A working key, permitted model, and provider billing are needed to verify live responses.

## Validation

```sh
npm run check
```

This runs TypeScript checking, the production build, date/zodiac domain tests, and HTTP API tests. Provider tests use a controlled fake response; they verify integration and failure handling without spending API credits. They do not prove that a real provider key works.

Useful readiness endpoints are `GET /api/health` and `GET /api/config`. Create a profile with `POST /api/profile`, then request `POST /api/reading` with `{ "profile": { "name": "Alex", "birthDate": "1995-05-21" }, "focus": "general" }`.

## Cloud setup

Use the existing `/workspace/Astrology_AI` checkout. Cloud tasks are already isolated; do not create another Git worktree.

```sh
cd /workspace/Astrology_AI
npm ci --cache /workspace/.cache/npm --no-audit --no-fund
npm run check
npm run dev
```

The writable cache flag is necessary in this cloud workspace. Install and startup instructions are saved separately in the environment draft. Review and save them in environment settings, then publish to retain the prepared filesystem. Processes must be started again in future tasks; configuration saving itself neither starts services nor publishes the environment.

## Privacy and persistence

The server does not store profiles or chat messages. A profile is kept in browser local storage until removed using the profile controls or cleared by the browser. Questions are held in the current page's state and disappear on reload. Avoid entering sensitive personal information into questions, especially in live AI mode.

## Structure

- `src/`: React interface and styling.
- `server/astrology.mjs`: date validation, sign definitions, and local reflections.
- `server/app.mjs`: JSON API, optional AI integration, and frontend serving.
- `tests/`: built-in Node tests for the domain and HTTP API.

No database, separate service, or API credential is required for the local workflow.
