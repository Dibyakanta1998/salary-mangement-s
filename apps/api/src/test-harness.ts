import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { Transaction } from "sequelize";
import { createApp } from "./app.js";
import { bindTestTransaction, sequelize } from "./db/sequelize.js";

export async function withApp(fn: (base: string, transaction: Transaction) => Promise<void>): Promise<void> {
  const transaction = await sequelize.transaction();
  bindTestTransaction(transaction);
  const server = createServer(createApp());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    await fn(`http://127.0.0.1:${port}`, transaction);
  } finally {
    bindTestTransaction(undefined);
    try {
      await transaction.rollback();
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  }
}
