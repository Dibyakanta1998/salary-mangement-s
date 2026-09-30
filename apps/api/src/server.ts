import path from "node:path";
import { createApp } from "./app.js";
import { migrate, seed, waitForPostgres } from "./db/migrate.js";

async function main(): Promise<void> {
  const apiRoot = path.resolve(__dirname, "..");
  await waitForPostgres();
  await migrate(apiRoot);
  await seed(apiRoot);
  createApp().listen(3000, "0.0.0.0");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
