import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import config from "./config.js";

const RETRIES = 30;
const RETRY_MS = 1000;
const MAINTENANCE_DATABASE = "postgres";

type Connection = (typeof config)["development"];

function pgClient(db: Connection, database: string): Client {
  return new Client({
    host: db.host,
    port: db.port,
    user: db.username,
    password: db.password,
    database,
  });
}

async function withClient(db: Connection, database: string, fn: (client: Client) => Promise<void>): Promise<void> {
  const client = pgClient(db, database);
  try {
    await client.connect();
    await fn(client);
  } finally {
    await client.end().catch(() => undefined);
  }
}

function errorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") return error.code;
  return undefined;
}

function quoteIdent(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error("Invalid database name");
  return `"${name}"`;
}

async function ensureDatabase(db: Connection): Promise<void> {
  try {
    await withClient(db, db.database, async () => undefined);
    return;
  } catch (error) {
    if (errorCode(error) !== "3D000") throw error;
  }
  await withClient(db, MAINTENANCE_DATABASE, async (client) => {
    try {
      await client.query(`CREATE DATABASE ${quoteIdent(db.database)}`);
    } catch (error) {
      if (errorCode(error) !== "42P04") throw error;
    }
  });
}

export async function waitForPostgres(): Promise<void> {
  const db = config.development;
  let lastError: unknown;
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    try {
      await ensureDatabase(db);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < RETRIES) await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
    }
  }
  throw lastError;
}

function sequelizeCli(apiRoot: string): string {
  const candidates = [
    path.resolve(apiRoot, "node_modules/.bin/sequelize-cli"),
    path.resolve(apiRoot, "../../node_modules/.bin/sequelize-cli"),
  ];
  const cli = candidates.find((candidate) => existsSync(candidate));
  if (!cli) throw new Error("sequelize-cli is not installed");
  return cli;
}

function runCli(apiRoot: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(sequelizeCli(apiRoot), args, { cwd: apiRoot }, (error, stdout, stderr) => {
      if (stdout) process.stdout.write(stdout);
      if (stderr) process.stderr.write(stderr);
      if (error) reject(error);
      else resolve();
    });
  });
}

export function migrate(apiRoot: string): Promise<void> {
  return runCli(apiRoot, ["db:migrate"]);
}

export function seed(apiRoot: string): Promise<void> {
  return runCli(apiRoot, ["db:seed:all"]);
}
