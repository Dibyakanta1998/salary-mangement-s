import { Sequelize, type Transaction } from "sequelize";
import config from "./config.js";

const db = config.development;

export const sequelize = new Sequelize(db.database, db.username, db.password, {
  host: db.host,
  port: db.port,
  dialect: db.dialect,
  logging: false,
});

// ponytail: one process-wide transaction so in-process HTTP handlers share the test rollback.
// Ceiling: this file's tests must run serially. Upgrade path: AsyncLocalStorage per request.
let testTransaction: Transaction | undefined;

export function bindTestTransaction(transaction: Transaction | undefined): void {
  testTransaction = transaction;
}

export function currentTestTransaction(): Transaction | undefined {
  return testTransaction;
}
