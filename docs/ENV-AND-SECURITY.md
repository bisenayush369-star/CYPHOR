# Settings, keys and security

Where the settings go, what every variable does, how keys are kept from leaking, and what to do before other people can reach the app. This page lists variable **names** only. No real key appears in this pack, and none should ever be pasted into a chat, an issue or a commit.

## 1. Where settings live

| Place | Holds | Notes |
| --- | --- | --- |
| `LLM.env` (or `.env.llm`), next to `package.json` | Provider keys, one `NAME=value` per line | Plain lines, read by the server only and never sent to the browser. Ignored by git. |
| `.env.local` | Everything else: database, limits, password | Next.js loads `.env` and `.env.local` by itself. Ignored by git. |
| The real environment | Anything | A variable that is really set in the environment wins over both files. |

After you edit `LLM.env`, restart the server or press **Refresh** in Settings > Router. `.env.example` lists every name with no value; copy the lines you need.

`LLM_ENV_DISABLE=1` makes the server ignore `LLM.env` and `.env.llm`. The automated tests set it so they never pick up a developer's real keys.

A value that is blank, or a tuning number that does not start with a positive whole number, is ignored and the default is used.

## 2. Provider keys

One line per provider you have. Leave out the rest; with no key at all the demo model answers.

| Id | Name | Key variable | Also accepted | Address variable | Default address |
| --- | --- | --- | --- | --- | --- |
| `anthropic` | Anthropic | `ANTHROPIC_API_KEY` | - | `ANTHROPIC_BASE_URL` | `https://api.anthropic.com` |
| `gemini` | Google Gemini | `GEMINI_API_KEY` | `GOOGLE_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY` | `GEMINI_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta/openai` |
| `groq` | Groq | `GROQ_API_KEY` | - | `GROQ_BASE_URL` | `https://api.groq.com/openai/v1` |
| `openrouter` | OpenRouter | `OPENROUTER_API_KEY` | - | `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` |
| `zai` | Z.AI (GLM) | `ZAI_API_KEY` | `Z_AI_API_KEY`, `ZHIPU_API_KEY` | `ZAI_BASE_URL` | `https://api.z.ai/api/paas/v4` |
| `nvidia` | NVIDIA NIM | `NVIDIA_API_KEY` | `NVIDIA_NIM_API_KEY` | `NVIDIA_BASE_URL` | `https://integrate.api.nvidia.com/v1` |
| `cohere` | Cohere | `COHERE_API_KEY` | `CO_API_KEY` | `COHERE_BASE_URL` | `https://api.cohere.ai/compatibility/v1` |
| `mistral` | Mistral | `MISTRAL_API_KEY` | - | `MISTRAL_BASE_URL` | `https://api.mistral.ai/v1` |
| `meta` | Meta Llama | `META_API_KEY` | `LLAMA_API_KEY` | `META_BASE_URL`, `LLAMA_BASE_URL` | `https://api.llama.com/compat/v1` |
| `cloudflare` | Cloudflare Workers AI | `CLOUDFLARE_API_KEY` | `CLOUDFLARE_API_TOKEN`, `CF_API_TOKEN` | `CLOUDFLARE_BASE_URL` | `https://api.cloudflare.com/client/v4/accounts/{account}/ai/v1` |
| `aionlabs` | AionLabs | `AIONLABS_API_KEY` | `AION_API_KEY` | `AIONLABS_BASE_URL`, `AION_BASE_URL` | `https://api.aionlabs.ai/v1` |
| `custom` | Your server | `LLM_API_KEY` (optional) | - | `LLM_BASE_URL` | none: you set it |

- A provider is "connected" when its key is set (for `custom`, when its address is). Cloudflare also needs `CLOUDFLARE_ACCOUNT_ID`, or a token that may read your account.
- **Your own server** (`custom`): `LLM_BASE_URL` is its address (everything before `/chat/completions`), `LLM_API_KEY` only if it needs one, `LLM_MODELS` (or `LLM_MODEL`) a comma-separated list of the model ids to offer.
- **Web search** is a tool, not a chat model: `TINYFISH_API_KEY` (or `TINYFISH_KEY`).
- Several providers let you point somewhere else with the address variable in the table, or pin the list of models with a `..._MODELS` variable, for example `GROQ_MODELS=a,b`.

## 3. Everything else

| Variable | Default | What it does |
| --- | --- | --- |
| `DATABASE_URL` | `file:./.data/cyphor.db` | SQLite file, or a Turso address (`libsql://...`) |
| `DATABASE_AUTH_TOKEN` | none | The Turso token |
| `CYPHOR_BASIC_AUTH` | off | `name:password`: one shared password for the whole app (section 5) |
| `RATE_LIMIT_CHAT_PER_MIN` | 20 | Chat requests (and provider tests) per visitor per minute |
| `RATE_LIMIT_API_PER_MIN` | 120 | Other API calls per visitor per minute |
| `RATE_LIMIT_GOD_PER_MIN` | 6 | God Mode messages per visitor per minute |
| `RATE_LIMIT_AUTH_PER_MIN` | 10 | Wrong passwords per address per minute |
| `ROUTER_FIRST_BYTE_MS` | 25000 | How long to wait for a model's first word before trying another (1.6 times longer for thinking models) |
| `CATALOG_TTL_SEC` | 600 | How long the model lists are remembered |
| `GODMODE_MAX_PANEL` | 6 | The most providers God Mode may ask at once |
| `GODMODE_DRAFT_MS` | 45000 | Stop waiting for drafts after this long |
| `GODMODE_GRACE_MS` | 8000 | Extra wait for slower providers once two drafts are in |
| `APP_URL` | `http://localhost:3000` | The public address; sent to OpenRouter as the referrer |
| `LLM_ENV_DISABLE` | unset | `1`: ignore `LLM.env` (tests only) |

The browser tests also read `DEMO_PORT`, `ROUTER_PORT`, `FAKE_LLM_PORT`, `SKIP_BUILD`, `BASE_URL`, `ROUTER_URL`, `PW_CHROMIUM_PATH` and `PW_NO_SANDBOX`. See [TESTING.md](./TESTING.md).

## 4. How keys are kept from leaking

- **They stay on the server.** Keys are read from `LLM.env` or the environment in `lib/router/env.ts`. The API tells the browser only the **name** of the variable (`keyEnv`), never its value.
- **Error text is filtered.** Providers sometimes repeat a key in an error ("Incorrect API key provided: ..."), and error text is shown on screen. Everything the server sends as words goes through `scrubSecrets`, which replaces the value of any variable whose name ends in `API_KEY`, `KEY`, `TOKEN`, `SECRET` or `PASSWORD` with `[key hidden]` (values of at least 8 characters).
- **Git ignores them.** `.gitignore` lists `LLM.env`, `.env.llm`, `.env*.local`, `.data` and `*.db`. The checker in this pack fails if `.gitignore` stops ignoring `LLM.env`, `.env.llm` or `.env.local`.
- **Tests use fake keys.** Every key in the repository's tests is obviously made up, and the checker never opens `LLM.env` or any other file whose name starts with `.env`.
- **One exception, by design.** In Settings > Model, **Your own LLM** sends requests straight from the browser to the address you type, with the key you type, and the browser stores both (`localStorage`, key `cyphor:v1`). Use it for a server on your own machine, or a key you are happy to keep in that browser. Prefer the Cyphor server source, where keys never reach the browser. Settings > Privacy > Erase everything removes that stored key.

## 5. Before other people can reach the app

On your own machine the defaults are fine. Before you serve Cyphor anywhere else:

1. **Set `CYPHOR_BASIC_AUTH=name:password`.** Without it, anyone who can open the address can spend your provider keys. With it, every page and every API call asks for the password (the browser shows its own sign-in box). The name may not contain a colon; the password may; both must be non-empty. A value that is not `name:password` **locks** the app (503 `locked`) instead of opening it, so a typo is never an open door. The comparison does not reveal how much of a password was right.
2. **Serve it over https.** Basic sign-in sends the password with every request.
3. **Know what the password is.** It is one shared login, not user accounts. The anonymous visitor id (cookie `cyphor_owner`) only keeps people's saved chats apart; it is not authentication. To add accounts, replace the id in `proxy.ts` with your user id (conversations are stored by `owner_id`).
4. **Remember the limits are per process.** Rate limits and provider health live in memory. On several servers each counts alone; use Redis or Upstash in `lib/rate-limit.ts` if you need one shared count.
5. **Use a hosted database if the host's disk is temporary.** Set `DATABASE_URL` and `DATABASE_AUTH_TOKEN` to a Turso database; the default file in `.data/` is lost when a serverless host replaces the machine.
6. **Keep keys in the host's environment settings** rather than in a file in the deployed image.
7. **Set `APP_URL`** to the public address if you use OpenRouter.

Already in place without any setting: cross-site writes (a POST, PUT, PATCH or DELETE with an `Origin` from another site) are refused with 403; every API reply is `no-store`; `X-Content-Type-Options`, `Referrer-Policy` and `Permissions-Policy` headers are added; request bodies are size-capped (413); and requests are rate limited per visitor and per address ([API.md](./API.md) sections 1 and 3).

## 6. If a key may have leaked

A key in a screenshot, a chat, a commit, a log or a message has leaked, even if you deleted the message afterwards. Deleting the copy does not undo that.

1. **Rotate it at the provider**: create a new key, put it in `LLM.env`, delete the old one. This is the only real fix.
2. If it was committed to git, rotate first, then remove it from the history; the old key is dead either way.
3. Restart the server, or press Refresh in Settings > Router, and press Test on that provider.

## 7. Working with AI assistants safely

- **Never attach `LLM.env`, `.env.local` or any key to a chat**, and never paste one. An assistant can read any file it can open in the workspace, so if you can, keep real keys in your shell or host environment instead of a file in the project (a real environment variable wins over the file).
- `AGENTS.md` and `.github/copilot-instructions.md` tell assistants not to open, print or copy these files. That is an instruction, not a lock.
- **Review what an assistant wants to run.** Copying files with `cp`, `Copy-Item` or `[IO.File]::Copy` is expected. Anything that deletes, publishes, or sends a file to a service is not part of applying these files.
- A screenshot of an `.env` file shows its keys. If one was shared, rotate those keys (section 6).
