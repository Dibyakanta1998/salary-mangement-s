# Salary management implementation plan

**Goal:** One command, `make dev`, starts Postgres, the API, and the web app, with tables and the 10,000-person seed already applied, so the HR manager can keep current base pay and read how the organisation pays.

**Architecture:** Three Compose services. The official `postgres:16` image holds the data. Sequelize, inside the API, migrates and seeds on startup, and the seed runs only when the people table is empty. The React app is static files behind nginx and never calculates money.

**Tech stack:** TypeScript, Express, Sequelize, PostgreSQL 16, React, Vite, Tailwind, Docker Compose, Make.

**Design to follow:** `doc/requirement/requirements.md`, `doc/design/hld.md`, `doc/design/lld.md`. If this plan and the low-level design disagree, the low-level design wins.

## Rules for every step

- Start the product with `make dev` only. Do not ask anyone to run migrate or seed by hand.
- `db` is the official `postgres:16` image. Sequelize runs in `api`. On API start: wait for Postgres, `sequelize-cli db:migrate`, then `sequelize-cli db:seed:all`. The seed returns immediately when any employee exists.
- A behaviour is not done until its unit test exists and `make test` passes.
- One step is one commit. Do not batch later steps into an earlier commit.
- When a step has a screen, check it in the Cursor browser at `http://localhost:8080` before that commit. A screenshot is not the check. Use the screen: filter, open a person, save.
- Do not add auth, charts, Redis, delete-person, or a second database.

## Step 1 — The project starts

**Commit:** `Add the Compose stack and make dev.`

**Create:** `Makefile`, `docker-compose.yml`, `package.json` (npm workspaces: `apps/api`, `apps/web`, `packages/lookups`), `apps/api/Dockerfile`, `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/src/server.ts`, `apps/web/Dockerfile`, `apps/web/nginx.conf`, `apps/web/package.json`, `apps/web/index.html`, `apps/web/src/main.tsx`.

**Do:**

- `make dev` runs `docker compose up --build`.
- `make test` is present and exits 0 with no tests yet.
- `make reset` runs `docker compose down -v`.
- `db` uses `image: postgres:16`, a healthcheck, and a named volume. Its port is not published.
- `api` waits for a healthy `db`, listens on 3000 inside the network only, and answers `GET /api/health` with `{ "ok": true }`.
- `web` publishes `8080:80`. nginx proxies `/api` to `http://api:3000`.
- The page at `/` can be a single line of text. Styling comes in a later step.

**Check:** `make dev`, then `curl -s http://localhost:8080/api/health` returns `{"ok":true}`. Open `http://localhost:8080` in the Cursor browser and confirm the page loads.

## Step 2 — Shared lookups

**Commit:** `Share the country, level, and department lists.`

**Create:** `packages/lookups/package.json`, `packages/lookups/lookups.json` with the five countries and currencies, L1–L6, and the five departments from the low-level design.

**Check:** Both apps can import the JSON. No second copy of the country list.

## Step 3 — Tables

**Commit:** `Add Sequelize migrations for people, history, and bands.`

**Create:** `apps/api/.sequelizerc`, `apps/api/src/db/sequelize.ts`, `apps/api/src/db/migrations/`, models for `employees`, `salary_changes`, and `salary_bands` as specified in the low-level design. An API entry script that migrates before listen. No seed yet. `sync()` is not used.

**Do:** Money columns are `DECIMAL(12, 2)`. Currency is a column with the five country checks. Leave date is required only when status is left. Band primary key is `(country, level)`.

**Check:** `make reset && make dev`. After startup, the three tables exist in Postgres. Restarting `make dev` does not fail and does not duplicate rows. There is still no seed, so the tables are empty.

## Step 4 — Create and find a person

**Commit:** `Add create and search for people, with tests.`

**Create:** employee routes, controller, service, Zod schemas, `apps/api/src/employee.test.ts`.

**Tests, and they fail before the routes exist:**

- Create stores currency from the country and rejects a body that sends currency.
- Duplicate employee id returns 409 and does not overwrite. `Ab` and `ab` are two people.
- List defaults to active, page size 50, sorted by legal name then employee id.
- `q` matches a case-sensitive substring of the id or a case-insensitive substring of the name.
- `GET /api/person?employeeId=` returns 404 when the id is missing, and returns `monthlyBase` as annual divided by 12, half-up, not stored.

**Check:** `make test` passes. `make dev` still migrates on start.

## Step 5 — Save, history, and employment

**Commit:** `Record pay, country, and status changes in one transaction.`

**Modify:** `apps/api/src/employee.service.ts`. **Test:** extend `apps/api/src/employee.test.ts`.

**Tests:**

- A base change, a country change, and a status change each write one history row. One request that changes all three still writes one row.
- Country change keeps the typed new base. Nothing is converted. Currency on the person becomes the new country’s currency.
- Create, including create-already-left, writes no history.
- Name, department, level, manager, start date, and a leave-date edit that stays left write no history and do not require a note.
- A real change with no note returns 400 and leaves the person unchanged.
- Setting someone back to active clears the leave date, requires a note, and they count as active again.
- `PATCH` rejects a partial body and rejects `employeeId` or `currency` in the body.

**Check:** `make test` passes.

## Step 6 — How the organisation pays

**Commit:** `Answer pay questions from active people in one currency.`

**Create:** `apps/api/src/figures.service.ts`, figures route, `apps/api/src/figures.test.ts`.

**Tests:**

- No country: `{ kind: "perCurrency", lines }` with currency, headcount, and total only. No median. A currency with nobody is omitted.
- One country: headcount, median, total, `byDepartment`, `byLevel`. A country with nobody returns zeros, a null median, and empty arrays.
- Even median half-up (`1.00` and `2.01` → `1.51`). Odd count is the middle value. One person is that base.
- A leaver is excluded. A `status` query does not change the figures.
- Blank department is its own row. Headline headcount equals the sum of the department rows and the sum of the level rows.
- Amounts are decimal strings. No query adds two currencies.

**Check:** `make test` passes.

## Step 7 — Bands

**Commit:** `Add pay bands and the outside-band list.`

**Create:** band routes and `apps/api/src/bands.test.ts`.

**Tests:**

- Put sets min and max. Min above max is 400. Clear deletes the row. A missing cell is not a row.
- Outside list requires country and level and has no department filter.
- Strictly under and strictly over are returned with `side` and `gap`. Equal to min or max is absent. No band returns an empty list.
- Band changes write no person history and need no note.

**Check:** `make test` passes.

## Step 8 — The last 30 days

**Commit:** `List pay and employment changes from the last 30 days.`

**Create:** `GET /api/changes` and `apps/api/src/changes.test.ts`.

**Tests:** A change inside 30 days is listed. An older change on the same person is not. The person endpoint still returns both in the last 10. Newest first. Each row has the employee id and legal name.

**Check:** `make test` passes.

## Step 9 — One-time seed

**Commit:** `Seed ten thousand people once on startup.`

**Create:** `apps/api/src/db/seeders/` and wire `sequelize-cli db:seed:all` into the API entrypoint after migrate.

**Do:** Deterministic generator, constant `20260930`, no faker package. About 10,000 people across every country, level, and department. Some blank department, manager, and start date. Two people share a legal name. Some are left, with a leave date. No bands. Inside 30 days: one pay change, one country move, one end of employment, each with a note. One of those people also has an earlier change outside the window. If any employee exists, the seed returns without writing.

**Check:** `make reset && make dev`. People count is about 10,000. `GET /api/changes` returns the three recent rows and not the older one. Run `make dev` again and the count does not double. `make test` still passes.

## Step 10 — People screen

**Commit:** `Show people and pay figures in the web app.`

**Create:** `apps/web` Vite app, Tailwind, `src/api/client.ts`, `src/pages/Home.tsx`, filter bar, figures panel, people table. Import lookups from `packages/lookups`. No Redux. No chart library.

**Do:** Route `/`. Filters in the query string. Status defaults to active. The figures request sends country, department, and level only. The people request also sends status, search, and page. Page size 50. Amounts render with the currency code from the payload. Department and level tables render only when `kind` is `country`.

**Browser, after `make dev`:**

- Open `http://localhost:8080`. The people table shows ids next to names. The first page is 50 rows, not 10,000.
- With no country, the page shows one line per currency and no median.
- Choose India. Headcount, median, and total appear in INR. Department and level tables appear. Confirm a blank-department row if the seed has one.
- Set status to left. The table changes. The headline numbers do not.
- Search for the shared legal name. Both people appear, with different ids.

## Step 11 — Person screen

**Commit:** `Add and edit a person from one form.`

**Create:** `src/pages/Person.tsx` at `/people/new` and `/people?id=`.

**Do:** Same form. Employee id editable only on create. Currency is read-only and follows the country. Note is shown only when base, country, or active status will change. Monthly line prints `monthlyBase`. Last 10 changes on the page. No delete control. A 409 says the id is already on file.

**Browser:**

- Add a person in India. The new row appears in the India list. Currency is INR. No history yet.
- Change only the department. Save without a note. History count stays the same.
- Change the base. The form requires a note. After save, the last change shows old and new base, and the India total changes.
- Move the person to Germany and type a new base in EUR. The history line shows the old amount with India and the new amount with Germany. The India total no longer includes them.
- Mark them left. They disappear from the active list and remain findable with status left.

## Step 12 — Changes and bands

**Commit:** `Show recent changes and pay bands.`

**Create:** `src/pages/Changes.tsx` (`/changes`), `src/pages/Bands.tsx` (`/bands`).

**Do:** Changes lists the last 30 days. Bands list the 30 cells, all “no band” on a fresh seed. Set and clear call the API. Opening a set band shows the outside list. No note on band edits.

**Browser:**

- `/changes` shows the seeded raise, country move, and leaver, and not the older change.
- Set a band for India L1 with a minimum and maximum that some seeded people fall outside. The outside list names them, with under or over and a gap, in INR. A person sitting on the minimum is absent.
- Clear the band. The cell says no band and the outside list is gone.
- Enter a minimum above the maximum. The page shows the error and does not save.

## Step 13 — Web unit tests

**Commit:** `Cover the three screen rules with unit tests.`

**Create:** Vitest tests under `apps/web`:

- The figures request does not include status.
- A `perCurrency` payload shows no median and no department or level tables.
- Monthly pay is rendered from `monthlyBase` and the test does not divide by 12.

**Check:** `make test` runs the API suite and these three tests, and both pass. `make dev` still starts the full stack.

## Done when

- `make dev` is the only command needed to open `http://localhost:8080` with data.
- A second start does not seed again.
- `make test` passes.
- The browser checks in steps 10, 11, and 12 have been done on that running stack.
- The commit history is these thirteen steps, in order.
