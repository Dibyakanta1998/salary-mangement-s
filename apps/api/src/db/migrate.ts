import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import config from "./config";

const RETRIES = 30;
const RETRY_MS = 1000;

export async function waitForPostgres(): Promise<void> {
  const db = config.development;
  let lastError: unknown;
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    const client = new Client({
      host: db.host,
      port: db.port,
      user: db.username,
      password: db.password,
      database: db.database,
    });
    try {
      await client.connect();
      return;
    } catch (error) {
      lastError = error;
      if (attempt < RETRIES) await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
    } finally {
      await client.end().catch(() => undefined);
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

export function migrate(apiRoot: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(sequelizeCli(apiRoot), ["db:migrate"], { cwd: apiRoot }, (error, stdout, stderr) => {
      if (stdout) process.stdout.write(stdout);
      if (stderr) process.stderr.write(stderr);
      if (error) reject(error);
      else resolve();
    });
  });
}
