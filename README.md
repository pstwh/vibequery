## vibequery

I always wanted to do a web client‑side WASM DuckDB project like that but didn't have time, so tried now with vibe coding and manual refining just for fun.

A tiny, vibe‑coded app to load data files, query them locally with DuckDB‑WASM, and visualize results right in your browser.

Try here: https://pstwh.github.io/vibequery

![App screenshot](docs/example.jpg)

### What it does

- **Drag‑and‑drop data import**: Load CSV, Parquet, JSON, XLSX, and formats. Files never leave your machine.

- **SQL console (DuckDB‑WASM)**: Run queries, paginate results, export CSV/JSON, create views, and browse query history.

- **Quick visuals from SQL**: Use `@hist`, `@bar`, `@scatter`, `@line` before a SELECT to render charts instantly.

- **AI assist (Gemini)**: Type `@gemini your natural language request` to generate a SQL query against your loaded schema.

- **Graph view**: See files, tables, and views as a connected graph with interactive layout and handy controls.

- **Projects**: Organize work into projects; files, views, and history persist per project.

### Gemini setup

- **Set your own API key**: Open Settings in the app and paste your Gemini API key.

- The key is stored locally in your browser.

### Disclaimer

This is experimental software for local data exploration. AI‑generated SQL may be incorrect, incomplete, or fail to run.

### Storage

- The app is completely client‑side.

- All information (projects, files, views, history, settings, API key) is stored on your device.


