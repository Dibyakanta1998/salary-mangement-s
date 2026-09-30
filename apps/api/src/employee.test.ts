import assert from "node:assert/strict";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import type { Transaction } from "sequelize";
import { QueryTypes } from "sequelize";
import { migrate, waitForPostgres } from "./db/migrate";
import { sequelize } from "./db/sequelize";
import { withApp } from "./test-harness";

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
  history?: HistoryRow[];
};

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

function saveBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const fields = personBody();
  delete fields.employeeId;
  return { ...fields, ...overrides };
}

async function patchPerson(base: string, employeeId: string, body: unknown): Promise<Response> {
  return fetch(`${base}/api/person?employeeId=${encodeURIComponent(employeeId)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function getPerson(base: string, employeeId: string): Promise<Person> {
  const response = await fetch(`${base}/api/person?employeeId=${encodeURIComponent(employeeId)}`);
  assert.equal(response.status, 200);
  return readJson<Person>(response);
}

async function changeCount(transaction: Transaction, employeeId: string): Promise<number> {
  const rows = await sequelize.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM salary_changes WHERE employee_id = $1",
    { bind: [employeeId], type: QueryTypes.SELECT, transaction },
  );
  return Number(rows[0].count);
}

async function employeeXmin(transaction: Transaction, employeeId: string): Promise<string> {
  const rows = await sequelize.query<{ xmin: string }>(
    "SELECT xmin::text AS xmin FROM employees WHERE employee_id = $1",
    { bind: [employeeId], type: QueryTypes.SELECT, transaction },
  );
  return rows[0].xmin;
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
      const namePrefix = "pqlist7k2m";
      const left = await postPerson(
        base,
        personBody({
          employeeId: "left-1",
          legalName: `${namePrefix} Aaa`,
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
          personBody({
            employeeId: `id-${suffix}`,
            legalName: `${namePrefix} Name ${suffix}`,
            annualBase: "1.50",
          }),
        );
        assert.equal(response.status, 201);
      }
      const second = await postPerson(
        base,
        personBody({ employeeId: "b", legalName: `${namePrefix} Aaron`, annualBase: "1000.00" }),
      );
      const first = await postPerson(
        base,
        personBody({ employeeId: "a", legalName: `${namePrefix} Aaron`, annualBase: "1000.00" }),
      );
      assert.equal(second.status, 201);
      assert.equal(first.status, 201);

      const response = await fetch(`${base}/api/people?q=${encodeURIComponent(namePrefix)}`);
      assert.equal(response.status, 200);
      const body = await readJson<ListBody>(response);
      assert.deepEqual(Object.keys(body).sort(), ["page", "pageSize", "people", "total"]);
      assert.equal(body.page, 1);
      assert.equal(body.pageSize, 50);
      assert.equal(body.total, 51);
      assert.equal(body.people.length, 50);
      assert.ok(body.people.every((person) => person.legalName.startsWith(`${namePrefix} `)));
      assert.equal(body.people[0].employeeId, "a");
      assert.equal(body.people[0].legalName, `${namePrefix} Aaron`);
      assert.equal(body.people[1].employeeId, "b");
      assert.equal(body.people[1].legalName, `${namePrefix} Aaron`);
      assert.equal(body.people[2].legalName, `${namePrefix} Name 00`);
      assert.equal(body.people[49].legalName, `${namePrefix} Name 47`);
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

  test("create, including create already left, writes no history", async () => {
    await withApp(async (base, transaction) => {
      const activeId = "s5-create-active";
      const leftId = "s5-create-left";
      assert.equal((await postPerson(base, personBody({ employeeId: activeId }))).status, 201);
      assert.equal(
        (
          await postPerson(
            base,
            personBody({ employeeId: leftId, status: "left", leaveDate: "2023-12-31" }),
          )
        ).status,
        201,
      );
      assert.equal(await changeCount(transaction, activeId), 0);
      assert.equal(await changeCount(transaction, leftId), 0);
      const active = await getPerson(base, activeId);
      const left = await getPerson(base, leftId);
      assert.deepEqual(active.history, []);
      assert.equal(active.lastChangeAt, null);
      assert.equal(active.lastNote, null);
      assert.deepEqual(left.history, []);
      assert.equal(left.status, "left");
      assert.equal(left.leaveDate, "2023-12-31");
    });
  });

  test("base, country, and status changes each write one history row", async () => {
    await withApp(async (base, transaction) => {
      const baseId = "s5-base";
      assert.equal((await postPerson(base, personBody({ employeeId: baseId, annualBase: "100000.00" }))).status, 201);
      const raised = await patchPerson(base, baseId, saveBody({ annualBase: "120000.00", note: "  raise  " }));
      assert.equal(raised.status, 200);
      const raisedBody = await readJson<Person>(raised);
      assert.equal(raisedBody.employeeId, baseId);
      assert.equal(raisedBody.annualBase, "120000.00");
      assert.equal(raisedBody.currency, "INR");
      assert.equal(await changeCount(transaction, baseId), 1);
      const raisedHistory = (await getPerson(base, baseId)).history?.[0];
      assert.ok(raisedHistory);
      assert.equal(typeof raisedHistory.changedAt, "string");
      assert.equal(raisedHistory.oldBase, "100000.00");
      assert.equal(raisedHistory.newBase, "120000.00");
      assert.equal(raisedHistory.oldCountry, null);
      assert.equal(raisedHistory.newCountry, "India");
      assert.equal(raisedHistory.oldStatus, "active");
      assert.equal(raisedHistory.newStatus, "active");
      assert.equal(raisedHistory.note, "raise");

      const moveId = "s5-move";
      assert.equal((await postPerson(base, personBody({ employeeId: moveId, annualBase: "100000.00" }))).status, 201);
      const moved = await patchPerson(
        base,
        moveId,
        saveBody({ country: "Germany", annualBase: "100000.00", note: "move" }),
      );
      assert.equal(moved.status, 200);
      const movedBody = await readJson<Person>(moved);
      assert.equal(movedBody.country, "Germany");
      assert.equal(movedBody.currency, "EUR");
      assert.equal(movedBody.annualBase, "100000.00");
      assert.equal(await changeCount(transaction, moveId), 1);
      const movedHistory = (await getPerson(base, moveId)).history?.[0];
      assert.ok(movedHistory);
      assert.equal(movedHistory.oldBase, movedHistory.newBase);
      assert.equal(movedHistory.oldBase, "100000.00");
      assert.equal(movedHistory.newBase, "100000.00");
      assert.equal(movedHistory.oldCountry, "India");
      assert.equal(movedHistory.newCountry, "Germany");
      assert.equal(movedHistory.oldStatus, "active");
      assert.equal(movedHistory.newStatus, "active");

      const leftId = "s5-left";
      assert.equal((await postPerson(base, personBody({ employeeId: leftId, annualBase: "80000.00" }))).status, 201);
      const left = await patchPerson(
        base,
        leftId,
        saveBody({ status: "left", leaveDate: "2024-06-01", annualBase: "80000.00", note: "bye" }),
      );
      assert.equal(left.status, 200);
      const leftBody = await readJson<Person>(left);
      assert.equal(leftBody.status, "left");
      assert.equal(leftBody.leaveDate, "2024-06-01");
      assert.equal(leftBody.annualBase, "80000.00");
      assert.equal(await changeCount(transaction, leftId), 1);
      const leftHistory = (await getPerson(base, leftId)).history?.[0];
      assert.ok(leftHistory);
      assert.equal(leftHistory.oldBase, leftHistory.newBase);
      assert.equal(leftHistory.oldCountry, null);
      assert.equal(leftHistory.newCountry, "India");
      assert.equal(leftHistory.oldStatus, "active");
      assert.equal(leftHistory.newStatus, "left");

      const allId = "s5-all";
      assert.equal((await postPerson(base, personBody({ employeeId: allId, annualBase: "100000.00" }))).status, 201);
      const all = await patchPerson(
        base,
        allId,
        saveBody({
          country: "Singapore",
          annualBase: "64000.50",
          status: "left",
          leaveDate: "2025-01-15",
          note: "all three",
        }),
      );
      assert.equal(all.status, 200);
      const allBody = await readJson<Person>(all);
      assert.equal(allBody.employeeId, allId);
      assert.equal(allBody.country, "Singapore");
      assert.equal(allBody.currency, "SGD");
      assert.equal(allBody.annualBase, "64000.50");
      assert.equal(allBody.status, "left");
      assert.equal(allBody.leaveDate, "2025-01-15");
      assert.equal(await changeCount(transaction, allId), 1);
      const allHistory = (await getPerson(base, allId)).history?.[0];
      assert.ok(allHistory);
      assert.equal(allHistory.oldBase, "100000.00");
      assert.equal(allHistory.newBase, "64000.50");
      assert.equal(allHistory.oldCountry, "India");
      assert.equal(allHistory.newCountry, "Singapore");
      assert.equal(allHistory.oldStatus, "active");
      assert.equal(allHistory.newStatus, "left");
      assert.equal(allHistory.note, "all three");
    });
  });

  test("profile edits and a no-op write no history and do not require a note", async () => {
    await withApp(async (base, transaction) => {
      const id = "s5-profile";
      assert.equal(
        (
          await postPerson(
            base,
            personBody({ employeeId: id, status: "left", leaveDate: "2024-01-01", annualBase: "50000.00" }),
          )
        ).status,
        201,
      );
      const createdXmin = await employeeXmin(transaction, id);
      const saved = await patchPerson(
        base,
        id,
        saveBody({
          legalName: "Grace Hopper",
          department: "Finance",
          level: "L4",
          managerEmployeeId: "mgr-9",
          startDate: "2019-03-01",
          status: "left",
          leaveDate: "2024-08-20",
          annualBase: "50000.00",
          note: "ignored",
        }),
      );
      assert.equal(saved.status, 200);
      const body = await readJson<Person>(saved);
      assert.equal(body.legalName, "Grace Hopper");
      assert.equal(body.department, "Finance");
      assert.equal(body.level, "L4");
      assert.equal(body.managerEmployeeId, "mgr-9");
      assert.equal(body.startDate, "2019-03-01");
      assert.equal(body.leaveDate, "2024-08-20");
      assert.equal(body.status, "left");
      assert.equal(body.country, "India");
      assert.equal(body.annualBase, "50000.00");
      assert.equal(await changeCount(transaction, id), 0);
      const viewed = await getPerson(base, id);
      assert.equal(viewed.lastNote, null);
      assert.deepEqual(viewed.history, []);
      const editedXmin = await employeeXmin(transaction, id);
      assert.notEqual(editedXmin, createdXmin);

      const noop = await patchPerson(
        base,
        id,
        saveBody({
          legalName: "Grace Hopper",
          department: "Finance",
          level: "L4",
          managerEmployeeId: "mgr-9",
          startDate: "2019-03-01",
          status: "left",
          leaveDate: "2024-08-20",
          annualBase: "50000.00",
          country: "India",
          note: "still ignored",
        }),
      );
      assert.equal(noop.status, 200);
      assert.equal(await changeCount(transaction, id), 0);
      assert.equal(await employeeXmin(transaction, id), editedXmin);
      const after = await getPerson(base, id);
      assert.deepEqual(after.history, []);
      assert.equal(after.lastNote, null);

      const activeId = "s5-noop";
      assert.equal((await postPerson(base, personBody({ employeeId: activeId }))).status, 201);
      const activeXmin = await employeeXmin(transaction, activeId);
      const cleared = await patchPerson(base, activeId, saveBody({ leaveDate: "2020-01-01", note: "nope" }));
      assert.equal(cleared.status, 200);
      const clearedBody = await readJson<Person>(cleared);
      assert.equal(clearedBody.leaveDate, null);
      assert.equal(clearedBody.status, "active");
      assert.equal(await changeCount(transaction, activeId), 0);
      assert.equal(await employeeXmin(transaction, activeId), activeXmin);
    });
  });

  test("a real change with no note returns 400 and leaves the person unchanged", async () => {
    await withApp(async (base, transaction) => {
      const cases = [
        { id: "s5-nonote-base", patch: { annualBase: "1.00" } },
        { id: "s5-nonote-country", patch: { country: "Germany" } },
        { id: "s5-nonote-status", patch: { status: "left", leaveDate: "2024-06-01" } },
        { id: "s5-nonote-blank", patch: { annualBase: "1.00", note: "   " } },
      ];
      for (const item of cases) {
        assert.equal((await postPerson(base, personBody({ employeeId: item.id, annualBase: "100000.00" }))).status, 201);
        const before = await getPerson(base, item.id);
        const xmin = await employeeXmin(transaction, item.id);
        const rejected = await patchPerson(base, item.id, saveBody(item.patch));
        assert.equal(rejected.status, 400);
        const error = await readJson<ErrorBody>(rejected);
        assert.equal(error.error.code, "VALIDATION_ERROR");
        assert.equal(error.error.details, null);
        assert.equal(typeof error.error.message, "string");
        assert.deepEqual(await getPerson(base, item.id), before);
        assert.equal(await employeeXmin(transaction, item.id), xmin);
        assert.equal(await changeCount(transaction, item.id), 0);
      }
    });
  });

  test("setting someone back to active clears the leave date and requires a note", async () => {
    await withApp(async (base) => {
      const id = "s5-back";
      assert.equal(
        (
          await postPerson(
            base,
            personBody({
              employeeId: id,
              legalName: "Returned Person",
              status: "left",
              leaveDate: "2024-02-02",
              annualBase: "42000.00",
            }),
          )
        ).status,
        201,
      );
      const denied = await patchPerson(
        base,
        id,
        saveBody({ status: "active", leaveDate: "2024-02-02", annualBase: "42000.00" }),
      );
      assert.equal(denied.status, 400);
      const stillLeft = await getPerson(base, id);
      assert.equal(stillLeft.status, "left");
      assert.equal(stillLeft.leaveDate, "2024-02-02");
      assert.deepEqual(stillLeft.history, []);

      const restored = await patchPerson(
        base,
        id,
        saveBody({ status: "active", leaveDate: "2024-02-02", annualBase: "42000.00", note: "rehired" }),
      );
      assert.equal(restored.status, 200);
      const body = await readJson<Person>(restored);
      assert.equal(body.status, "active");
      assert.equal(body.leaveDate, null);
      assert.equal(body.annualBase, "42000.00");
      const person = await getPerson(base, id);
      assert.equal(person.history?.length, 1);
      const history = person.history?.[0];
      assert.ok(history);
      assert.equal(history.oldBase, history.newBase);
      assert.equal(history.oldBase, "42000.00");
      assert.equal(history.oldCountry, null);
      assert.equal(history.newCountry, "India");
      assert.equal(history.oldStatus, "left");
      assert.equal(history.newStatus, "active");
      assert.equal(history.note, "rehired");

      const activeList = await fetch(`${base}/api/people?q=${encodeURIComponent(id)}`);
      assert.equal(activeList.status, 200);
      const activeBody = await readJson<ListBody>(activeList);
      assert.equal(
        activeBody.people.some((person) => person.employeeId === id && person.status === "active"),
        true,
      );
      const leftList = await fetch(`${base}/api/people?q=${encodeURIComponent(id)}&status=left`);
      const leftBody = await readJson<ListBody>(leftList);
      assert.equal(
        leftBody.people.some((person) => person.employeeId === id),
        false,
      );
    });
  });

  test("patch rejects a partial body and rejects employeeId or currency", async () => {
    await withApp(async (base) => {
      const id = "s5-partial";
      assert.equal(
        (await postPerson(base, personBody({ employeeId: id, legalName: "Original", annualBase: "100.00" }))).status,
        201,
      );
      const before = await getPerson(base, id);

      const partial = await patchPerson(base, id, { legalName: "Nope" });
      assert.equal(partial.status, 400);
      const partialError = await readJson<ErrorBody>(partial);
      assert.equal(partialError.error.code, "VALIDATION_ERROR");
      assert.ok(Array.isArray(partialError.error.details));

      const missingDepartment = saveBody();
      delete missingDepartment.department;
      const omitted = await patchPerson(base, id, missingDepartment);
      assert.equal(omitted.status, 400);

      const withId = await patchPerson(base, id, { ...saveBody(), employeeId: "other-id" });
      assert.equal(withId.status, 400);
      const idError = await readJson<ErrorBody>(withId);
      assert.equal(idError.error.code, "VALIDATION_ERROR");
      assert.ok(Array.isArray(idError.error.details));

      const withCurrency = await patchPerson(base, id, { ...saveBody(), currency: "USD" });
      assert.equal(withCurrency.status, 400);
      const currencyError = await readJson<ErrorBody>(withCurrency);
      assert.equal(currencyError.error.code, "VALIDATION_ERROR");
      assert.ok(Array.isArray(currencyError.error.details));

      const missing = await patchPerson(base, "s5-missing-person", saveBody({ note: "x" }));
      assert.equal(missing.status, 404);
      const missingError = await readJson<ErrorBody>(missing);
      assert.equal(missingError.error.code, "NOT_FOUND");
      assert.equal(missingError.error.details, null);

      const after = await getPerson(base, id);
      assert.equal(after.employeeId, id);
      assert.equal(after.legalName, "Original");
      assert.equal(after.annualBase, "100.00");
      assert.equal(after.currency, "INR");
      assert.deepEqual(after, before);
    });
  });
});
