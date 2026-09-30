import type { Dialect } from "sequelize";

const connection = {
  username: process.env.POSTGRES_USER ?? "salary",
  password: process.env.POSTGRES_PASSWORD ?? "salary",
  database: process.env.POSTGRES_DB ?? "salary",
  host: process.env.PGHOST ?? "db",
  port: Number(process.env.PGPORT ?? 5432),
  dialect: "postgres" as Dialect,
};

const config = {
  development: connection,
  test: connection,
  production: connection,
};

export = config;
