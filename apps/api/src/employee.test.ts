import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import type { Transaction } from "sequelize";
import { QueryTypes } from "sequelize";
import { createApp } from "./app";
import { migrate, waitForPostgres } from "./db/migrate";
import { bindTestTransaction, sequelize } from "./db/sequelize";

type Person = {
  employeeId: string;
  legalName: string;
  country: string;
  currency: string;
  level: string;
  annualBase: string;
  status: string;
  department: string | null;
  managerEmployeeId: string | null;
  startDate: string | null;
  leaveDate: string | null;
  monthlyBase?: string;
  lastChangeAt?: string | null;
  lastNote?: string | null;
  history?: unknown[];
};

type ErrorBody = { error: { code: string; message: string; details: unknown } };

type ListBody = { page: number; pageSize: number; total: number; people: Person[] };

function personBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    employeeId: "E1",
    legalName: "Ada Lovelace",
    country: "India",
    level: "L1",
    annualBase: "100000.00",
    status: "active",
    department: "Engineering",
    managerEmployeeId: null,
    startDate: null,
    leaveDate: null,
    ...overrides,
  };
}

async function withApp(fn: (base: string, transaction: Transaction) => Promise<void>): Promise<void> {
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

async function postPerson(base: string, body: unknown): Promise<Response> {
  return fetch(`${base}/api/people`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

describe("people", { concurrency: false }, () => {
  before(async () => {
    await waitForPostgres();
    await migrate(path.resolve(__dirname, ".."));
    await sequelize.authenticate();
  });

  after(async () => {
    await sequelize.close();
  });

  test("create stores currency from the country and rejects a client currency", async () => {
    await withApp(async (base, transaction) => {
      const created = await postPerson(base, personBody({ employeeId: "cur-india", annualBase: "100000.00" }));
      assert.equal(created.status, 201);
      const person = await readJson<Person>(created);
      assert.equal(person.currency, "INR");
      assert.equal(person.country, "India");
      assert.equal(person.annualBase, "100000.00");

      const stored = await sequelize.query<{ currency: string }>(
        "SELECT currency FROM employees WHERE employee_id = $1",
        { bind: ["cur-india"], type: QueryTypes.SELECT, transaction },
      );
      assert.equal(stored[0].currency.trim(), "INR");

      const rejected = await postPerson(
        base,
        personBody({ employeeId: "cur-with-currency", currency: "USD" }),
      );
      assert.equal(rejected.status, 400);
      const error = await readJson<ErrorBody>(rejected);
      assert.equal(error.error.code, "VALIDATION_ERROR");
      assert.equal(typeof error.error.message, "string");
      assert.ok(Array.isArray(error.error.details));

      const missing = await fetch(`${base}/api/person?employeeId=cur-with-currency`);
      assert.equal(missing.status, 404);
    });
  });

  test("duplicate employee id returns 409 and does not overwrite; case differs", async () => {
    await withApp(async (base) => {
      const first = await postPerson(
        base,
        personBody({ employeeId: "Dup1", legalName: "Original", annualBase: "100.00" }),
      );
      assert.equal(first.status, 201);

      const again = await postPerson(
        base,
        personBody({ employeeId: "Dup1", legalName: "Changed", annualBase: "9999.00" }),
      );
      assert.equal(again.status, 409);
      const error = await readJson<ErrorBody>(again);
      assert.equal(error.error.code, "DUPLICATE_EMPLOYEE_ID");
      assert.equal(error.error.details, null);
      assert.equal(typeof error.error.message, "string");

      const stored = await readJson<Person>(await fetch(`${base}/api/person?employeeId=Dup1`));
      assert.equal(stored.legalName, "Original");
      assert.equal(stored.annualBase, "100.00");

      const upper = await postPerson(base, personBody({ employeeId: "Ab", legalName: "Upper" }));
      const lower = await postPerson(base, personBody({ employeeId: "ab", legalName: "Lower" }));
      assert.equal(upper.status, 201);
      assert.equal(lower.status, 201);
      const upperBody = await readJson<Person>(upper);
      const lowerBody = await readJson<Person>(lower);
      assert.equal(upperBody.employeeId, "Ab");
      assert.equal(lowerBody.employeeId, "ab");
      assert.equal(upperBody.legalName, "Upper");
      assert.equal(lowerBody.legalName, "Lower");
    });
  });

  test("list defaults to active, page size 50, sorted by legal name then employee id", async () => {
    await withApp(async (base) => {
      const left = await postPerson(
        base,
        personBody({
          employeeId: "left-1",
          legalName: "Aaa",
          status: "left",
          leaveDate: "2024-05-01",
          annualBase: "10.00",
        }),
      );
      assert.equal(left.status, 201);
      for (let index = 48; index >= 0; index -= 1) {
        const suffix = String(index).padStart(2, "0");
        const response = await postPerson(
          base,
          personBody({ employeeId: `id-${suffix}`, legalName: `Name ${suffix}`, annualBase: "1.50" }),
        );
        assert.equal(response.status, 201);
      }
      const second = await postPerson(
        base,
        personBody({ employeeId: "b", legalName: "Aaron", annualBase: "1000.00" }),
      );
      const first = await postPerson(
        base,
        personBody({ employeeId: "a", legalName: "Aaron", annualBase: "1000.00" }),
      );
      assert.equal(second.status, 201);
      assert.equal(first.status, 201);

      const response = await fetch(`${base}/api/people`);
      assert.equal(response.status, 200);
      const body = await readJson<ListBody>(response);
      assert.deepEqual(Object.keys(body).sort(), ["page", "pageSize", "people", "total"]);
      assert.equal(body.page, 1);
      assert.equal(body.pageSize, 50);
      assert.equal(body.total, 51);
      assert.equal(body.people.length, 50);
      assert.equal(body.people[0].employeeId, "a");
      assert.equal(body.people[0].legalName, "Aaron");
      assert.equal(body.people[1].employeeId, "b");
      assert.equal(body.people[1].legalName, "Aaron");
      assert.equal(body.people[2].legalName, "Name 00");
      assert.equal(body.people[49].legalName, "Name 47");
      assert.equal(body.people.some((person) => person.employeeId === "left-1"), false);
      assert.equal(body.people[0].annualBase, "1000.00");
      assert.equal(typeof body.people[0].annualBase, "string");
      assert.deepEqual(Object.keys(body.people[0]).sort(), [
        "annualBase",
        "country",
        "currency",
        "department",
        "employeeId",
        "leaveDate",
        "legalName",
        "level",
        "managerEmployeeId",
        "startDate",
        "status",
      ]);
    });
  });

  test("q matches case-sensitive employee id or case-insensitive legal name", async () => {
    await withApp(async (base) => {
      assert.equal(
        (await postPerson(base, personBody({ employeeId: "ZzAb", legalName: "No Match Here" }))).status,
        201,
      );
      assert.equal(
        (await postPerson(base, personBody({ employeeId: "nomatch", legalName: "zzab person" }))).status,
        201,
      );

      const idsFor = async (q: string): Promise<string[]> => {
        const response = await fetch(`${base}/api/people?q=${encodeURIComponent(q)}`);
        assert.equal(response.status, 200);
        const body = await readJson<ListBody>(response);
        return body.people.map((person) => person.employeeId).sort();
      };

      assert.deepEqual(await idsFor("ZzAb"), ["ZzAb", "nomatch"]);
      assert.deepEqual(await idsFor("zzab"), ["nomatch"]);
      assert.deepEqual(await idsFor("MATCH"), ["ZzAb"]);
      assert.deepEqual(await idsFor("NOMATCH"), []);
    });
  });

  test("person is 404 when missing, and monthlyBase is annual divided by 12 half-up", async () => {
    await withApp(async (base) => {
      const missing = await fetch(`${base}/api/person?employeeId=does-not-exist`);
      assert.equal(missing.status, 404);
      const missingBody = await readJson<ErrorBody>(missing);
      assert.equal(missingBody.error.code, "NOT_FOUND");
      assert.equal(missingBody.error.details, null);
      assert.equal(typeof missingBody.error.message, "string");

      const blank = await fetch(`${base}/api/person?employeeId=`);
      assert.equal(blank.status, 404);

      assert.equal(
        (await postPerson(base, personBody({ employeeId: "month-a", annualBase: "100000.00" }))).status,
        201,
      );
      assert.equal(
        (await postPerson(base, personBody({ employeeId: "month-b", annualBase: "10.00" }))).status,
        201,
      );
      assert.equal(
        (await postPerson(base, personBody({ employeeId: "month-c", annualBase: "1.26" }))).status,
        201,
      );

      const high = await readJson<Person>(await fetch(`${base}/api/person?employeeId=month-a`));
      const low = await readJson<Person>(await fetch(`${base}/api/person?employeeId=month-b`));
      const half = await readJson<Person>(await fetch(`${base}/api/person?employeeId=month-c`));
      assert.equal(high.monthlyBase, "8333.33");
      assert.equal(low.monthlyBase, "0.83");
      assert.equal(half.monthlyBase, "0.11");
      assert.equal(typeof high.monthlyBase, "string");
      assert.equal(high.lastChangeAt, null);
      assert.equal(high.lastNote, null);
      assert.deepEqual(high.history, []);

      const columns = await sequelize.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'monthly_base'`,
        { type: QueryTypes.SELECT },
      );
      assert.equal(columns.length, 0);
    });
  });
});
