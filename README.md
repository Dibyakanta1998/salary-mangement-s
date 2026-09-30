# Salary management

A small app for one HR manager to keep current annual base pay for about 10,000 people, and to see headcount, totals, and medians without adding different currencies together.

## What you need

- Docker, with Compose
- Make
- Node.js 22, only for the web tests in `make test`

There is no `.env` file. Database user, password, and database name are `salary`, set in `docker-compose.yml`.

## Start

From this directory:

```bash
make dev
```

That builds and starts three containers:

| Service | Role |
| --- | --- |
| `db` | Postgres 16. Data stays in the `salary_data` volume. |
| `api` | Node API. On start it waits for Postgres, runs migrations, then seeds once. |
| `web` | The React app, served by nginx. |

Open [http://localhost:8080](http://localhost:8080).

The first start loads about 10,000 people. A later `make dev` keeps that data. The seed runs only while the people table is empty.

Stop it with Ctrl+C. The database volume remains, so the next `make dev` comes back with the same people.

## Tests

```bash
make test
```

API tests run in Docker against a separate `salary_test` database on the same Postgres instance. They migrate that database and do not seed it. Web tests run with Vitest on your machine, so run `npm ci` once from this directory before the first `make test` if `node_modules` is not already there.

## Reset the database

```bash
make reset
```

That removes the containers and the Postgres volume. The next `make dev` loads the seed again.
