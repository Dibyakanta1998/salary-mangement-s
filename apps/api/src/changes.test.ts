import assert from "node:assert/strict";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import type { Transaction } from "sequelize";
import { QueryTypes } from "sequelize";
import { migrate, waitForPostgres } from "./db/migrate.js";
import { sequelize } from "./db/sequelize.js";
import { withApp } from "./test-harness.js";

type HistoryRow = {
  changedAt: string;
  oldBase: string;
  newBase: string;
  oldCountry: string | null;
  newCountry: string;
  oldStatus: string;
  newStatus: string;
  note: string;
};

type ChangeRow = HistoryRow & { employeeId: string; legalName: string };

const employeeId = "s8-changes";
const legalName = "Ada Changes";

function personBody(annualBase = "100000.00"): Record<string, unknown> {
  return {
    employeeId,
    legalName,
    country: "India",
    level: "L1",
    annualBase,
    status: "active",
    department: "Engineering",
    managerEmployeeId: null,
    startDate: null,
    leaveDate: null,
  };
}

function saveBody(annualBase: string, note: string): Record<string, unknown> {
  const body = personBody(annualBase);
  delete body.employeeId;
  return { ...body, note };
}

async function backdate(transaction: Transaction, note: string, days: number): Promise<void> {
  const rows = await sequelize.query<{ changed_at: Date }>(
    `UPDATE salary_changes
     SET changed_at = now() - ($3 || ' days')::interval
     WHERE employee_id = $1 AND note = $2
     RETURNING changed_at`,
    { bind: [employeeId, note, String(days)], type: QueryTypes.SELECT, transaction },
  );
  assert.equal(rows.length, 1);
}

describe("changes", { concurrency: false }, () => {
  before(async () => {
    await waitForPostgres();
    await migrate(path.resolve(__dirname, ".."));
    await sequelize.authenticate();
  });

  after(async () => {
    await sequelize.close();
  });

  test("lists the last 30 days newest first, and the person still keeps the older row", async () => {
    await withApp(async (base, transaction) => {
      const created = await fetch(`${base}/api/people`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(personBody()),
      });
      assert.equal(created.status, 201);

      const older = await fetch(`${base}/api/person?employeeId=${encodeURIComponent(employeeId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(saveBody("110000.00", "old-raise")),
      });
      assert.equal(older.status, 200);

      const middle = await fetch(`${base}/api/person?employeeId=${encodeURIComponent(employeeId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(saveBody("120000.00", "mid-raise")),
      });
      assert.equal(middle.status, 200);

      const recent = await fetch(`${base}/api/person?employeeId=${encodeURIComponent(employeeId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(saveBody("130000.00", "new-raise")),
      });
      assert.equal(recent.status, 200);

      await backdate(transaction, "old-raise", 40);
      await backdate(transaction, "mid-raise", 1);

      const listed = await fetch(`${base}/api/changes`);
      assert.equal(listed.status, 200);
      const changes = (await listed.json()) as ChangeRow[];

      const mine = changes.filter((row) => row.employeeId === employeeId);
      assert.deepEqual(
        mine.map((row) => row.note),
        ["new-raise", "mid-raise"],
      );
      assert.equal(
        changes.some((row) => row.employeeId === employeeId && row.note === "old-raise"),
        false,
      );

      for (let index = 1; index < changes.length; index += 1) {
        assert.ok(Date.parse(changes[index - 1].changedAt) >= Date.parse(changes[index].changedAt));
      }
      for (const row of changes) {
        assert.equal(typeof row.employeeId, "string");
        assert.equal(typeof row.legalName, "string");
      }
      for (const row of mine) {
        assert.equal(row.legalName, legalName);
        assert.equal(row.oldCountry, null);
        assert.equal(row.newCountry, "India");
        assert.equal(row.oldStatus, "active");
        assert.equal(row.newStatus, "active");
      }
      assert.equal(mine[0].oldBase, "120000.00");
      assert.equal(mine[0].newBase, "130000.00");

      const personResponse = await fetch(`${base}/api/person?employeeId=${encodeURIComponent(employeeId)}`);
      assert.equal(personResponse.status, 200);
      const person = (await personResponse.json()) as { history: HistoryRow[] };
      assert.ok(person.history.length <= 10);
      assert.deepEqual(
        person.history.map((row) => row.note),
        ["new-raise", "mid-raise", "old-raise"],
      );
    });
  });
});
