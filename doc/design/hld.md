# High-level design

## What this is

This is the place the HR manager keeps current annual base pay for about 10,000 people, and the place that answers how the organisation pays. The number that matters is annual gross base pay, in the currency of the country where the person works.

It is for that one person. It does not pay anyone, and it does not replace a full HR system.

Five countries are in scope. Choosing the country sets the currency. The currency cannot be typed.

| Country | Currency |
| --- | --- |
| India | INR |
| United States | USD |
| United Kingdom | GBP |
| Germany | EUR |
| Singapore | SGD |

An amount in one currency is never added to an amount in another. There is no exchange rate and no single company total.

Each person has an employee id, a legal name, a country, a level from L1 to L6, an annual base of zero or more, and a status of active or left. L1–L3 are individual contributors. L4–L6 are managers. There is no job title. Department, manager id, and start date are optional. Someone who has left stays on file. Leave date is required only while they are left, and it is cleared when they are active again. There is no delete.

## How it runs

Three Docker services, and no others:

| Service | What it is |
| --- | --- |
| `db` | Official `postgres:16` image. Sequelize does not replace Postgres. It is the way the API creates tables and loads data. |
| `api` | Node.js, TypeScript, Express, Sequelize |
| `web` | React, TypeScript, Vite, Tailwind. nginx serves the built files |

From the repository root, `make dev` is the one command. The Makefile runs Docker Compose. There is no env file to create. Defaults live in the Compose file.

On API start the process waits until Postgres accepts connections, runs Sequelize migrations, then runs the Sequelize seed. The seed is a one-time activity: if any person already exists, it does nothing. A second start keeps the data. The only persisted data is the Postgres volume. `make reset` removes that volume. The next `make dev` loads the seed again because the table is empty.

The browser uses one origin. nginx proxies `/api` to the API. The browser never talks to Postgres.

## Where the numbers are worked out

Headcount, total annual base, median, and the outside-band list are computed in PostgreSQL. Each of those answers stays inside one currency. The UI shows the figures it is given. It does not add amounts, and it does not compute medians.

Monthly pay is the annual amount divided by 12, half-up to two decimal places. It is computed when a person is read, returned as `monthlyBase`, and never stored. It is not a second salary.

With no country selected, the answer is one line per currency that still has a matching active person: headcount and total. No median. Department and level filters narrow those lines. The department and level tables stay hidden until a country is chosen.

With a country selected, the answer is headcount, median annual base, and total annual base for active people in that currency, plus a department table and a level table over the same people. The status filter changes the people table only. Figures stay on active people.

Median uses active people in the selected country, inside the department and level filters. An odd count takes the middle base. An even count takes the midpoint of the two middle bases, half-up to two decimal places. One person means that person’s base. Nobody means headcount 0, total 0, and a blank median.

A band is a minimum and maximum annual base for one country and one level. It applies to every department at that level. Until both amounts are set, there is no band. Someone is outside only when they are active and their base is strictly below the minimum or strictly above the maximum. Sitting on either edge is not outside. No band means the list is empty. The gap is the plain difference in that currency.

## Saving a person

A person save is one database transaction. It writes at most one history row, and only when annual base, country, or active/left status changes.

Adding a person writes no history, including a person created already left. A save that changes only name, department, level, manager, start date, or a leave date while the person stays left, writes no history. A save that changes nothing writes nothing.

When a history row is written, a note is required. The current base on the person remains the current base. Last change date and last note come from the latest history row. They are not fields of their own.

A country move is one save. The HR manager types the new annual base in the new country’s currency. The old amount is not converted. The person’s currency updates from the new country.

Changing or clearing a band does not change a person’s pay, does not ask for a note, and does not write history.

## The four screens

1. **People.** Search and filters, the pay figures for the current country, department, and level, and the people table. Status defaults to active. A row opens that person. Add opens an empty form.
2. **Person.** One form for add and edit. The employee id can be typed only when adding. Currency is shown from the selected country and cannot be edited. Monthly pay is the `monthlyBase` value from the API. The note field appears only when this save will change base, country, or active/left status. The last 10 history rows are on this page. There is no delete.
3. **Changes in the last 30 days.** Pay changes, country moves, and employment changes from the last 30 days, newest first.
4. **Bands.** Set or clear a minimum and maximum for a country and level. Opening a band that is set shows who is outside it. A cell with no band has no outside list. Band edits do not ask for a note.

After a successful save, the screen refetches the data that save affected.

## The repository

npm workspaces, from the repository root:

- `apps/api`
- `apps/web`
- `packages/lookups` — `lookups.json` only: countries and currencies, levels, departments
- `doc/requirement`
- `doc/design`

The web app imports the lookup file. The country list is not copied into the web app.

## Not in this version

Auth, Redis, GraphQL, charts, queues, a second database, delete person, import/export, averages, and exchange rates.

Also left out, because they would not help the Monday questions or they would make the numbers less trustworthy: payroll, tax, benefits, approvals, email, job titles, an org chart, a blended company total, allowances, target bonus, a gender field, bulk edit, a full history of every field, and any report of pay as it stood on a past date.
