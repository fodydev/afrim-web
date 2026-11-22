# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

npm workspaces monorepo (`packages/*`). Run from the repo root.

```sh
npm install
npm run build        # afrim-input (typecheck + prod bundle), then afrim-playground
npm run dev          # build afrim-input, then watch it + playground dev server with live reload
npm start            # serve packages/afrim-playground/dist on :8080 (PORT=… to change)
npm run fmt-check    # Prettier check (CI runs this + build)
npm run fmt          # Prettier write
npm -w afrim-input run typecheck   # tsc --noEmit only
```

There is no test suite. CI (`.github/workflows/ci.yml`) runs only `fmt-check` and `build`. To verify behavior, build and run the playground in a browser. Deployment is a manual workflow that publishes `packages/afrim-playground/dist` to GitHub Pages.

## Architecture

Two packages. Build order matters: the playground consumes afrim-input's **built output**, not its source.

- **`packages/afrim-input`** (TypeScript, webpack → UMD `dist/afrim_input.js` plus an async-loaded `afrim` wasm chunk, ~900 KB). It wraps the [`afrim`](https://www.npmjs.com/package/afrim) wasm IME and exports `AfrimInput`, `AfrimConfig` and `preloadAfrim` (`src/bootstrap.ts`).
  - `utils.ts`:
    - `loadAfrim()` memoizes the single `import("afrim")`. Every wasm use goes through it, so the download starts once and as early as possible.
    - `fetchText()` downloads with progress (ky, no timeout) and gunzips bodies that start with the gzip magic bytes.
  - `config.ts`: `AfrimConfig.loadFromUrl` parses TOML through the wasm `convertTomlToJson`, which returns nested `Map`s, not plain objects.
    - `{ path = … }` includes and `[translators]` scripts are downloaded **in parallel**, then merged **in their original order**, so later entries still override earlier ones. Keep that ordering if you touch it.
    - When the parent URL ends in `.gz`, relative `.toml` includes are resolved as `.toml.gz`.
  - `index.ts`: `AfrimInput` binds to DOM elements by id.
    - It drives the afrim `Preprocessor` on **keyup** and applies the queued commands (`CommitText`, `Delete`, `Pause`/`Resume`) to the text field, tracking the cursor itself.
    - It shows `Translator` predicates in a Bulma dropdown tooltip.
    - `ready` resolves once it is attached. Passing `config` skips the download.
- **`packages/afrim-playground`** (plain JS typing trainer, webpack). `webpack.common.js` copies `src/index.html` and **all of `../afrim-input/dist`** into its `dist`.
  - `index.html` loads `afrim_input.js` with a `<script>` tag, so `src/index.js` uses `AfrimInput` / `AfrimConfig` / `preloadAfrim` as **globals** (no imports).
  - In dev, the server serves afrim-input's `dist` directly so its watch rebuilds live-reload.

### Data source (afrim-data)

Datasets come from the afrim-data GitHub Pages site (`https://fodydev.github.io/afrim-data`; see that repo's README, "Web access").

- `datasets.json` lists `{name, description, version, dir, config}`.
- Configs are published as `*.toml.gz` with `content-type: application/gzip` and no `Content-Encoding`. That is why the client gunzips them itself.

In the playground:

- The base URL is `?dataUrl=` if given, otherwise `process.env.AFRIM_DATA_URL`, which `DefinePlugin` injects at build time from the `AFRIM_DATA_URL` env var.
- The language dropdown and the default language (the first entry) come from `datasets.json`.
- `?configUrl=` bypasses the list.

**Do not hard-code dataset URLs, language lists or display names in code, and do not use raw.githubusercontent.com.** Fix bad dataset names upstream in afrim-data's `[info] name`.

### Playground flow (`src/index.js`)

1. Settings come from URL params, then localStorage: `ime`, `dict` (the dictionary, off by default because it is large) and `pdict` (translators). Changing one reloads the page.
2. `main()` runs these steps:
   1. `preloadAfrim()`.
   2. Fetch `datasets.json` and resolve the config URL.
   3. `loadDataset()`: one `AfrimConfig` download, which also builds `hints` (character → shortest code) and the `charset` used for random drills.
   4. When the IME is on, `new AfrimInput({ config, … })` reuses that same config.
3. Rendering is incremental and per-keystroke work is kept small:
   - Target spans are built once per round (`round.spans`), and only the changed range is restyled.
   - `update()` is coalesced with `requestAnimationFrame`, because Afrim edits the field on keyup.
   - A 250 ms `tick()` only refreshes the timer from cached counts.

## Conventions

- Prettier is enforced in CI (`.prettierrc`). Run `npm run fmt` before finishing.
- afrim-input's `tsconfig` is strict (`noImplicitAny`, `noUnusedLocals/Parameters`, `noImplicitReturns`). Untyped deps get declarations in `src/types/` (for example `textarea-caret`).
- Keep afrim-input's public API stable: `AfrimInput` options, `ready` and `kill()`, plus `AfrimConfig.loadFromUrl(url, statusEl, ignoreTranslation, ignoreTranslators)`.
- Commit subjects follow `patch: …`, `chore: …`, `fix: …`.
