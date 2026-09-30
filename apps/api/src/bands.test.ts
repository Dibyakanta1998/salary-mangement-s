import assert from "node:assert/strict";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import type { Transaction } from "sequelize";
import { QueryTypes } from "sequelize";
import { migrate, waitForPostgres } from "./db/migrate";
import { sequelize } from "./db/sequelize";
import { withApp } from "./test-harness";

const money = /^\d+\.\d{2}$/;

type Band = {
  country: string;
  level: string;
  currency: string;
  minBase: string;
  maxBase: string;
};

type Outside = {
  employeeId: string;
  legalName: string;
  base: string;
  min: string;
  max: string;
  gap: string;
  side: "under" | "over";
};

type ErrorBody = { error: { code: string; message: string; details: unknown } };

function person(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    employeeId: "band",
    legalName: "Band Person",
    country: "India",
    level: "L1",
    annualBase: "100.00",
    status: "active",
    department: "Engineering",
    managerEmployeeId: null,
    startDate: null,
    leaveDate: null,
    ...overrides,
  };
}

async function create(base: string, overrides: Record<string, unknown>): Promise<void> {
  const response = await fetch(`${base}/api/people`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(person(overrides)),
  });
  assert.equal(response.status, 201);
}

function bandPath(country: string, level: string): string {
  return `/api/bands/${encodeURIComponent(country)}/${encodeURIComponent(level)}`;
}

async function putBand(base: string, country: string, level: string, body: unknown): Promise<Response> {
  return fetch(`${base}${bandPath(country, level)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function deleteBand(base: string, country: string, level: string): Promise<Response> {
  return fetch(`${base}${bandPath(country, level)}`, { method: "DELETE" });
}

async function getBands(base: string): Promise<Band[]> {
  const response = await fetch(`${base}/api/bands`);
  assert.equal(response.status, 200);
  return (await response.json()) as Band[];
}

async function getOutside(base: string, params: Record<string, string>): Promise<Response> {
  return fetch(`${base}/api/bands/outside?${new URLSearchParams(params)}`);
}

function cell(rows: Band[], country: string, level: string): Band | undefined {
  return rows.find((row) => row.country === country && row.level === level);
}

async function historyCount(transaction: Transaction, employeeId: string): Promise<number> {
  const rows = await sequelize.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM salary_changes WHERE employee_id = $1",
    { bind: [employeeId], type: QueryTypes.SELECT, transaction },
  );
  return Number(rows[0].count);
}

describe("bands", { concurrency: false }, () => {
  before(async () => {
    await waitForPostgres();
    await migrate(path.resolve(__dirname, ".."));
    await sequelize.authenticate();
  });

  after(async () => {
    await sequelize.close();
  });

  test("put sets min and max, rejects min above max, and clear removes the row", async () => {
    await withApp(async (base) => {
      const country = "United States";
      const level = "L3";
      assert.equal((await deleteBand(base, country, level)).status, 204);

      const missing = await getBands(base);
      assert.equal(cell(missing, country, level), undefined);
      assert.equal(
        missing.some((row) => row.minBase == null || row.maxBase == null),
        false,
      );

      const saved = await putBand(base, country, level, { minBase: "1000.00", maxBase: "2000.50" });
      assert.equal(saved.status, 200);
      const stored = (await saved.json()) as Band;
      assert.deepEqual(stored, {
        country,
        level,
        currency: "USD",
        minBase: "1000.00",
        maxBase: "2000.50",
      });
      assert.equal("note" in stored, false);
      assert.equal(cell(await getBands(base), country, level)?.minBase, "1000.00");

      const tooHigh = await putBand(base, country, level, { minBase: "9.00", maxBase: "8.99" });
      assert.equal(tooHigh.status, 400);
      const error = (await tooHigh.json()) as ErrorBody;
      assert.equal(error.error.code, "VALIDATION_ERROR");
      assert.deepEqual(cell(await getBands(base), country, level), stored);

      const unknown = await putBand(base, "France", level, { minBase: "1.00", maxBase: "2.00" });
      assert.equal(unknown.status, 400);

      assert.equal((await deleteBand(base, country, level)).status, 204);
      assert.equal((await deleteBand(base, country, level)).status, 204);
      assert.equal(cell(await getBands(base), country, level), undefined);
    });
  });

  test("outside list requires country and level and does not filter by department", async () => {
    await withApp(async (base) => {
      const country = "Germany";
      const level = "L2";
      await create(base, {
        employeeId: "s7-dept-eng",
        legalName: "Eng Under",
        country,
        level,
        department: "Engineering",
        annualBase: "10.00",
      });
      await create(base, {
        employeeId: "s7-dept-sales",
        legalName: "Sales Under",
        country,
        level,
        department: "Sales",
        annualBase: "10.00",
      });
      assert.equal((await deleteBand(base, country, level)).status, 204);
      assert.equal((await putBand(base, country, level, { minBase: "50.00", maxBase: "80.00" })).status, 200);

      const missingCountry = await getOutside(base, { level });
      assert.equal(missingCountry.status, 400);
      const missingLevel = await getOutside(base, { country });
      assert.equal(missingLevel.status, 400);

      const plain = await getOutside(base, { country, level });
      assert.equal(plain.status, 200);
      const withDepartment = await getOutside(base, { country, level, department: "Engineering" });
      assert.equal(withDepartment.status, 200);
      const plainRows = (await plain.json()) as Outside[];
      const filteredRows = (await withDepartment.json()) as Outside[];
      assert.deepEqual(filteredRows, plainRows);
      const ids = new Set(plainRows.map((row) => row.employeeId));
      assert.equal(ids.has("s7-dept-eng"), true);
      assert.equal(ids.has("s7-dept-sales"), true);
    });
  });

  test("strictly under and over are listed; edges and a missing band are not", async () => {
    await withApp(async (base) => {
      const country = "Singapore";
      const level = "L5";
      await create(base, { employeeId: "s7-under", legalName: "Under", country, level, annualBase: "90.00" });
      await create(base, { employeeId: "s7-over", legalName: "Over", country, level, annualBase: "200.01" });
      await create(base, { employeeId: "s7-min", legalName: "On Min", country, level, annualBase: "100.00" });
      await create(base, { employeeId: "s7-max", legalName: "On Max", country, level, annualBase: "200.00" });
      await create(base, {
        employeeId: "s7-left",
        legalName: "Left Under",
        country,
        level,
        annualBase: "1.00",
        status: "left",
        leaveDate: "2024-03-01",
      });
      await create(base, { employeeId: "s7-other-level", legalName: "Other Level", country, level: "L1", annualBase: "1.00" });

      assert.equal((await deleteBand(base, country, level)).status, 204);
      const none = await getOutside(base, { country, level });
      assert.equal(none.status, 200);
      assert.deepEqual(await none.json(), []);

      assert.equal((await putBand(base, country, level, { minBase: "100.00", maxBase: "200.00" })).status, 200);
      const response = await getOutside(base, { country, level });
      assert.equal(response.status, 200);
      const rows = (await response.json()) as Outside[];
      const byId = new Map(rows.map((row) => [row.employeeId, row]));
      assert.equal(byId.has("s7-min"), false);
      assert.equal(byId.has("s7-max"), false);
      assert.equal(byId.has("s7-left"), false);
      assert.equal(byId.has("s7-other-level"), false);

      const under = byId.get("s7-under");
      const over = byId.get("s7-over");
      assert.ok(under);
      assert.ok(over);
      assert.equal(under.side, "under");
      assert.equal(under.gap, "10.00");
      assert.equal(under.base, "90.00");
      assert.equal(under.min, "100.00");
      assert.equal(under.max, "200.00");
      assert.equal(under.legalName, "Under");
      assert.match(under.gap, money);
      assert.equal(over.side, "over");
      assert.equal(over.gap, "0.01");
      assert.equal(over.base, "200.01");
      assert.match(over.gap, money);
    });
  });

  test("band changes write no person history and need no note", async () => {
    await withApp(async (base, transaction) => {
      const employeeId = "s7-history";
      await create(base, { employeeId, country: "United Kingdom", level: "L6", annualBase: "40.00" });
      assert.equal(await historyCount(transaction, employeeId), 0);

      const saved = await putBand(base, "United Kingdom", "L6", { minBase: "10", maxBase: "50.5" });
      assert.equal(saved.status, 200);
      const body = (await saved.json()) as Band;
      assert.equal(body.currency, "GBP");
      assert.equal(body.minBase, "10.00");
      assert.equal(body.maxBase, "50.50");
      assert.equal(await historyCount(transaction, employeeId), 0);

      assert.equal((await deleteBand(base, "United Kingdom", "L6")).status, 204);
      assert.equal(await historyCount(transaction, employeeId), 0);
    });
  });
});
