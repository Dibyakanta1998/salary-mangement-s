import path from "node:path";
import { createApp } from "./app";
import { migrate, waitForPostgres } from "./db/migrate";

async function main(): Promise<void> {
  await waitForPostgres();
  await migrate(path.resolve(__dirname, ".."));
  createApp().listen(3000, "0.0.0.0");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
