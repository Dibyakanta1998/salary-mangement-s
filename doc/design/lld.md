# Low-level design

## Repository

npm workspaces at the repository root. `docker compose up --build` is run from that root.

```
apps/api          Node.js, TypeScript, Express, Sequelize
apps/web          React, TypeScript, Vite, Tailwind
packages/lookups  lookups.json only
doc/requirement
doc/design
```

`packages/lookups/lookups.json` is the shared list. Both apps import it. The web app does not keep its own copy of the countries.

```json
{
  "countries": [
    { "name": "India", "currency": "INR" },
    { "name": "United States", "currency": "USD" },
    { "name": "United Kingdom", "currency": "GBP" },
    { "name": "Germany", "currency": "EUR" },
    { "name": "Singapore", "currency": "SGD" }
  ],
  "levels": ["L1", "L2", "L3", "L4", "L5", "L6"],
  "departments": ["Engineering", "Sales", "People", "Finance", "Operations"]
}
```

L1–L3 are individual contributors. L4–L6 are managers. The file does not carry job titles.

The API is laid out as routes, thin controllers, services, and Sequelize models. Controllers validate with Zod, call one service method, and return JSON. `employee.service` is the only writer of `employees` and `salary_changes`. It also reads one person and the 30-day history list. `figures.service` only reads. `bands.service` reads and writes `salary_bands` only, and it never inserts a history row.

Country-to-currency mapping is read from `lookups.json` at runtime and repeated as a database check constraint on `employees` and on `salary_bands`.

## Data

Three tables. Money columns are `numeric`, never float. The API returns every money value as a decimal string. Application code does not put money in a JavaScript number. Sequelize decimal values stay strings.

Dates are calendar dates (`YYYY-MM-DD`). Timestamps are `timestamptz`, returned as ISO 8601 strings.

### employees

| Column | Rule |
| --- | --- |
| `employee_id` | `varchar(64)` primary key. Trimmed, length 1–64, stored as typed, case-sensitive, immutable |
| `legal_name` | `varchar(200)`, required, trimmed |
| `country` | One of India, United States, United Kingdom, Germany, Singapore |
| `currency` | `char(3)`, server-written only |
| `level` | L1–L6 |
| `annual_base` | `numeric(12,2) >= 0` |
| `status` | `active` or `left` |
| `leave_date` | Required if `left`, null if `active` |
| `department` | Engineering, Sales, People, Finance, Operations, or null |
| `manager_employee_id` | Optional `varchar(64)`. No foreign key. It need not match a real person |
| `start_date` | Optional date |

There is no `deleted_at`. There is no rule that orders start date, leave date, and today against each other.

`currency` check constraint, same pairs on both money tables:

- India / INR
- United States / USD
- United Kingdom / GBP
- Germany / EUR
- Singapore / SGD

Leave-date check: `(status = 'left' AND leave_date IS NOT NULL) OR (status = 'active' AND leave_date IS NULL)`.

### salary_changes

| Column | Rule |
| --- | --- |
| `id` | `bigint` identity primary key |
| `employee_id` | Foreign key to `employees`, on delete restrict |
| `changed_at` | `timestamptz`, default `now()` |
| `old_base`, `new_base` | `numeric(12,2)` |
| `old_country` | Null unless the country changed |
| `new_country` | Always set |
| `old_status`, `new_status` | Always set |
| `note` | `varchar(1000)`, required, trimmed, non-empty |

A row must represent a real change of base, country, or status. Check: `old_base` differs from `new_base`, or `old_country` is not null, or `old_status` differs from `new_status`. `old_country` is either null or different from `new_country`.

Indexes: `(employee_id, changed_at DESC)` and `(changed_at DESC)`.

### salary_bands

Primary key `(country, level)`. At most 30 rows, because that key is five countries by six levels.

| Column | Rule |
| --- | --- |
| `country`, `level` | Same allowed values as on a person |
| `currency` | Server-set, same country/currency check |
| `min_base`, `max_base` | `numeric(12,2) >= 0`, and `min_base <= max_base` |

No row means no band. Clearing a band deletes the row. Bands do not write `salary_changes`.

## API

Prefix `/api`. JSON requests and responses. Zod validates input. A body field that is the wrong type, an unknown country, level, department, or status, a negative amount, more than two decimal places, or a value that does not fit the column, is invalid.

One error shape:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [] } }
```

| HTTP | code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Zod failure, or a rule the service rejects before write |
| 404 | `NOT_FOUND` | Person id is not on file |
| 409 | `DUPLICATE_EMPLOYEE_ID` | Create hits an existing id. The existing row is left as it is |
| 500 | `INTERNAL` | Unexpected failure. `message` is generic |

`details` is the Zod issue list for a validation error, and null otherwise. Responses do not include stack traces.

A client-sent `currency` is rejected with 400. The server writes currency from the country.

There is no delete-person endpoint.

### Endpoints

| Method and path | Behavior |
| --- | --- |
| `GET /api/people` | Filtered page of people |
| `GET /api/person?employeeId=` | One person, monthly pay, last change, last 10 history rows |
| `POST /api/people` | Create. 201. No history row and no note |
| `PATCH /api/person?employeeId=` | Update from the full form |
| `GET /api/figures` | Pay figures for active people |
| `GET /api/changes` | History with `changed_at >= now() - 30 days` |
| `GET /api/bands` | Existing band rows |
| `PUT /api/bands/:country/:level` | Upsert `{ minBase, maxBase }` |
| `DELETE /api/bands/:country/:level` | Clear the band |
| `GET /api/bands/outside` | Active people strictly outside that band |
| `GET /api/health` | For Compose only. `200` `{ "ok": true }` |

Country in a band path is URL-encoded (`United%20States`). An unknown country or level on a band route is 400.

**GET /api/people.** Query: `q`, `country`, `department`, `level`, `status` (default `active`; only `active` or `left`), `page` (default 1), `pageSize` (default 50, max 100, minimum 1). Filters combine with AND. `q` matches a case-sensitive substring of employee id OR a case-insensitive substring of legal name. Sort is legal name ascending, then employee id ascending.

Response: `{ page, pageSize, total, people }`. Each person: `employeeId`, `legalName`, `country`, `currency`, `level`, `annualBase`, `status`, `department`, `managerEmployeeId`, `startDate`, `leaveDate`. Money is a decimal string. Empty optionals are null.

**GET /api/person.** One person with the same fields, plus `monthlyBase`, `lastChangeAt`, `lastNote`, and `history` (the last 10 rows, newest first). `monthlyBase` is `annual_base / 12`, rounded half-up to two decimals in PostgreSQL `numeric`, computed on this read, and not stored. `lastChangeAt` and `lastNote` come from the latest history row, or null when there is none. Each history row: `changedAt`, `oldBase`, `newBase`, `oldCountry`, `newCountry`, `oldStatus`, `newStatus`, `note`. Missing id is 404.

**POST /api/people.** Body: `employeeId`, `legalName`, `country`, `level`, `annualBase`, `status`, `department`, `managerEmployeeId`, `startDate`, `leaveDate`. No `currency`, no `note`. A person may be created already left, with a leave date, and still no history row. 201 returns the stored person, including the server-written `currency`. Duplicate id, including a difference of surrounding spaces only, is 409 and does not overwrite. Ids that differ only by case are two people.

**PATCH /api/person.** Query `employeeId`. The id is not in the body and never changes. A body that includes `employeeId` or `currency` is 400. The body is the full form: `legalName`, `country`, `level`, `annualBase`, `status`, `department`, `managerEmployeeId`, `startDate`, `leaveDate`, and `note` when a history row will be written. Omitted fields are invalid. `department`, `managerEmployeeId`, `startDate`, and `leaveDate` may be null. 200 returns the stored person. Unknown id is 404.

**GET /api/figures.** Query: `country`, `department`, `level`. `status` is ignored if it is sent. The population is always `status = 'active'`, plus the country, department, and level filters that were sent. Money fields are decimal strings.

No country:

```json
{ "kind": "perCurrency", "lines": [{ "currency": "INR", "headcount": 1, "totalAnnualBase": "0.00" }] }
```

No median, and no country on the line. Currencies with nobody are omitted.

With a country:

```json
{
  "kind": "country",
  "country": "India",
  "currency": "INR",
  "headcount": 0,
  "medianAnnualBase": null,
  "totalAnnualBase": "0.00",
  "byDepartment": [],
  "byLevel": []
}
```

A selected country with nobody still returns that currency, zeros, a null median, and empty arrays. Otherwise `byDepartment` rows are `{ department, headcount, medianAnnualBase, totalAnnualBase }`, sorted by total annual base descending. Blank department is a row with `department: null` when its count is at least 1. Empty groups are omitted. `byLevel` rows are `{ level, headcount, medianAnnualBase, totalAnnualBase }` for levels that remain, ordered L1 to L6. Headline headcount equals the sum of the department rows and the sum of the level rows.

**GET /api/changes.** No paging. Newest first. Each row includes the history fields plus `employeeId` and `legalName`. Name, department, and level edits never appear, because they do not write history.

**GET /api/bands.** Array of existing rows: `country`, `level`, `currency`, `minBase`, `maxBase`. A missing country and level is no band, not a row of nulls.

**PUT /api/bands/:country/:level.** Body `{ minBase, maxBase }` only. Both required, zero or more, at most two decimals, minimum not above maximum. Currency is set from the country. Upsert. 200 returns the stored band. No note.

**DELETE /api/bands/:country/:level.** Deletes the row. 204 if it was deleted or was already gone. No note.

**GET /api/bands/outside.** Query `country` and `level` are required. There is no department parameter; department is not applied. Active people whose base is strictly below `min_base` or strictly above `max_base`. Equal to an edge is absent. No band means an empty list, not an error. Response is a JSON array. Each row: `employeeId`, `legalName`, `base`, `min`, `max`, `gap`, `side`. `gap` is the plain positive difference as a decimal string (`min - base` when under, `base - max` when over). `side` is `under` or `over`.

## Person save

One database transaction. Load the existing row with `SELECT … FOR UPDATE`. Normalize the full form, then compare it with the stored row.

Normalization: trim employee id (create only), legal name, and note. Empty note after trim counts as missing. Map country through `lookups.json` and set currency from that pair. Coerce money as a decimal string with at most two places. Empty department, manager id, and start date become null. Status `left` requires a leave date. Status `active` clears leave date even if the body sent one.

Write one history row only if annual base, country, or status changed. The note is required only then. If it is missing, roll the transaction back and leave the stored person unchanged. A note sent when no history row is needed is ignored.

These writes do not create history: legal name, department, level, manager id, start date, and a leave-date correction that stays `left`. A no-op writes nothing and does not change `changed_at` on any row.

The history row, when written, stores `old_base` from the locked row and `new_base` from the form. If pay did not change, those two match. `old_country` is set only when the country changed; `new_country` is always the country’s value after the save. There is no conversion. The employee’s `currency` updates from the new country in the same update. `old_status` and `new_status` are the status before and after. Status to `left` sets leave date. Status to `active` sets leave date to null.

Create is a separate insert in one transaction: no lock of an existing row, no history row, no note. A unique violation on `employee_id` becomes 409.

## Median

Computed in SQL with `numeric`. `percentile_cont` is unsuitable because it returns float.

Odd count: the middle value in `annual_base` order. Even count: the midpoint of the two middle values, `ROUND((low + high) / 2, 2)` on `numeric` (half away from zero, which for these non-negative amounts is half-up). One person: that base. Zero people: headcount 0, total `0.00`, median null.

The headline, the department groups, and the level groups use the same WHERE: `status = 'active'` plus the requested country, department, and level. Status from the query string is not part of that WHERE. All three are read in one transaction at isolation level repeatable read.

Department groups include the null department when its count is at least 1, and exclude groups with nobody. Level groups that remain are ordered L1 to L6.

## Web

Vite, React, TypeScript, and Tailwind only. No component library, no Redux, no charts, no CSS-in-JS. Data fetching is local to the screens. Lookups come from `packages/lookups/lookups.json`.

Filters live in the query string. Every screen has a loading state, an error state with retry, and empty copy. Amounts are shown with the currency code, using the decimal strings from the API. The browser does not add amounts, compute medians, or divide annual pay by 12.

After a successful save, refetch the affected data. A 409 on create says the id is already on file.

1. **People, `/`.** Sticky filters: search, country, department, level, and status. Status defaults to `active`. The people table calls `GET /api/people` with all four filters plus search, page, and page size. Pagination is 50. Figures call `GET /api/figures` with country, department, and level only. That request must not send status. Department and level tables render only when `kind` is `country`. A `perCurrency` payload shows lines of currency, headcount, and total, with no median and no department or level tables. A row click opens the person. Add goes to the person form with no id.

2. **Person.** An existing person is `/people?id=`. Add is `/people/new`. Same form. Employee id is editable only on create. Currency is read-only text from the selected country. The note field is shown only when this save will change base, country, or active/left status. The monthly line prints `monthlyBase`. The last 10 changes are on this page. No delete control.

3. **Changes, `/changes`.** `GET /api/changes`. The last 30 days, newest first.

4. **Bands, `/bands`.** Set calls PUT. Clear calls DELETE. Opening a set band loads `GET /api/bands/outside` for that country and level. No band shows no outside list. No note on band edits.

## Tests

**API.** `node:test` and `node:assert`, through the HTTP app against Postgres. Each test inserts and asserts its own rows, so it does not depend on the seed and does not wipe the table.

Cover:

- Which edits write one history row (base, country, status to left, status back to active) and which write none (create, including create-already-left, name, department, level, manager, start date, leave-date correction while staying left, and a no-op).
- A missing note on a real change rolls back, so the person row is unchanged and no history row remains.
- Currency is derived from country, and a client-sent currency is rejected.
- Median: odd count, even count including a half-up case, one person, and nobody.
- Leavers are excluded from figures. A status query does not change figures.
- Outside band: under, over, on the edge, and no band.
- A duplicate id does not overwrite. Ids that differ only by case are two people.

**Web.** Vitest and Testing Library. Three tests only:

- The figures request does not include status.
- A `perCurrency` payload shows no median and no department or level tables.
- Monthly pay is rendered from `monthlyBase` and is not divided in the browser.

## Seed

Plain TypeScript. No faker. The generator is deterministic from the constant `20260930`.

Skip the whole seed if any employee exists. Migrations still run.

When the table is empty, insert about 10,000 people across all five countries, all levels L1–L6, and all five departments. Some rows have a null department, a null manager id, and a null start date. Two people share a legal name and have different ids. Some are `left` with a leave date. Insert no bands.

Then insert history so the current employee row matches the latest change:

- Inside 30 days: one pay change, one country move, and one end of employment, each with a note.
- One of those three people also has an earlier change with `changed_at` outside the 30-day window.

That person’s own history has both rows. The 30-day list has only the newer one.

## Docker and how to start

The repository root has a `Makefile`. `make dev` is the only start command. It runs `docker compose up --build`. No env file. Connection defaults are plain values in the Compose file, the same values for `db` and `api`.

| Target | What it does |
| --- | --- |
| `make dev` | Build and start `db`, `api`, and `web`. Leave them running. |
| `make test` | Run the API unit tests and the web unit tests. |
| `make reset` | `docker compose down -v`, which drops the Postgres volume. |

`db` uses the official image `postgres:16`, with a healthcheck. Sequelize is not a database image. It runs inside `api`. The data directory is a named volume. That volume is the only persisted data. The Postgres port is not published to the host.

`api` starts after the db healthcheck passes. Its entrypoint waits until Postgres accepts connections, runs `sequelize-cli db:migrate`, then `sequelize-cli db:seed:all`. The seed checks for any employee and returns immediately when one exists, so startup seeding is one time only. It then listens on port 3000 inside the Compose network. That port is not published to the host.

`web` is a multi-stage image: Vite build, then nginx serving the built files. nginx proxies `/api` to `http://api:3000`. The container listens on port 80 and Compose publishes that as host port 8080. The browser uses `http://localhost:8080` only.

`make reset`, then `make dev`, finds an empty people table and seeds again.

## Tests

Unit tests are part of the product, not a follow-up. A behaviour is not done until its test exists and passes under `make test`.

API tests use `node:test` and `node:assert`, through the HTTP app, against Postgres. They cover the save and history rules, currency, median, leavers, bands, and duplicate ids. Web tests use Vitest and Testing Library. There are three: the figures request omits status, a per-currency payload shows no median, and monthly pay is rendered from `monthlyBase`.

Screens are also checked in the Cursor browser against `http://localhost:8080` after `make dev`: load the people page, filter to one country, open a person, and confirm the figures match the API.
