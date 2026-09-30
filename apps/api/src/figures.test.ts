import assert from "node:assert/strict";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { migrate, waitForPostgres } from "./db/migrate";
import { sequelize } from "./db/sequelize";
import { withApp } from "./test-harness";

const money = /^\d+\.\d{2}$/;

type Group = {
  headcount: number;
  medianAnnualBase: string | null;
  totalAnnualBase: string;
};

type PerCurrency = {
  kind: "perCurrency";
  lines: { currency: string; headcount: number; totalAnnualBase: string }[];
};

type CountryFigures = Group & {
  kind: "country";
  country: string;
  currency: string;
  byDepartment: (Group & { department: string | null })[];
  byLevel: (Group & { level: string })[];
};

function person(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    employeeId: "fig",
    legalName: "Fig Person",
    country: "India",
    level: "L1",
    annualBase: "1.00",
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

async function figures<T>(base: string, params: Record<string, string>): Promise<T> {
  const response = await fetch(`${base}/api/figures?${new URLSearchParams(params)}`);
  assert.equal(response.status, 200);
  return (await response.json()) as T;
}

function assertMoney(value: string | null): void {
  if (value === null) return;
  assert.equal(typeof value, "string");
  assert.match(value, money);
}

describe("figures", { concurrency: false }, () => {
  before(async () => {
    await waitForPostgres();
    await migrate(path.resolve(__dirname, ".."));
    await sequelize.authenticate();
  });

  after(async () => {
    await sequelize.close();
  });

  test("no country returns per-currency lines without a median and omits an empty currency", async () => {
    await withApp(async (base) => {
      const slice = { department: "Operations", level: "L6" };
      await create(base, { employeeId: "fig-pc-in", country: "India", annualBase: "12.00", ...slice });
      await create(base, { employeeId: "fig-pc-de", country: "Germany", annualBase: "7.50", ...slice });
      await create(base, {
        employeeId: "fig-pc-sg",
        country: "Singapore",
        annualBase: "3.00",
        status: "left",
        leaveDate: "2024-01-02",
        ...slice,
      });
      await create(base, {
        employeeId: "fig-pc-uk",
        country: "United Kingdom",
        annualBase: "9.00",
        department: "Engineering",
        level: "L6",
      });

      const body = await figures<PerCurrency>(base, slice);
      assert.equal(body.kind, "perCurrency");
      assert.equal("medianAnnualBase" in body, false);
      assert.equal("country" in body, false);
      const byCurrency = new Map(body.lines.map((line) => [line.currency, line]));
      assert.equal(byCurrency.get("SGD"), undefined);
      assert.equal(byCurrency.get("GBP"), undefined);
      assert.equal(byCurrency.get("USD"), undefined);
      const inr = byCurrency.get("INR");
      const eur = byCurrency.get("EUR");
      assert.ok(inr);
      assert.ok(eur);
      assert.deepEqual(Object.keys(inr).sort(), ["currency", "headcount", "totalAnnualBase"]);
      assert.equal(inr.headcount, 1);
      assert.equal(inr.totalAnnualBase, "12.00");
      assert.equal(eur.headcount, 1);
      assert.equal(eur.totalAnnualBase, "7.50");
      assert.equal(typeof inr.totalAnnualBase, "string");
      assert.match(inr.totalAnnualBase, money);
      for (const line of body.lines) assert.ok(line.headcount >= 1);
    });
  });

  test("a country with nobody returns zeros, a null median, and empty arrays", async () => {
    await withApp(async (base) => {
      const body = await figures<CountryFigures>(base, {
        country: "United Kingdom",
        department: "People",
        level: "L5",
      });
      assert.deepEqual(body, {
        kind: "country",
        country: "United Kingdom",
        currency: "GBP",
        headcount: 0,
        medianAnnualBase: null,
        totalAnnualBase: "0.00",
        byDepartment: [],
        byLevel: [],
      });
    });
  });

  test("median is the middle base, the rounded midpoint when even, or that one base", async () => {
    await withApp(async (base) => {
      const even = { country: "Singapore", department: "Sales", level: "L4" };
      await create(base, { employeeId: "fig-even-a", annualBase: "1.00", ...even });
      await create(base, { employeeId: "fig-even-b", annualBase: "2.01", ...even });
      const evenBody = await figures<CountryFigures>(base, even);
      assert.equal(evenBody.medianAnnualBase, "1.51");
      assert.equal(evenBody.headcount, 2);
      assert.equal(evenBody.totalAnnualBase, "3.01");
      assert.equal(evenBody.currency, "SGD");

      const odd = { country: "Singapore", department: "Sales", level: "L5" };
      await create(base, { employeeId: "fig-odd-a", annualBase: "4.00", ...odd });
      await create(base, { employeeId: "fig-odd-b", annualBase: "15.00", ...odd });
      await create(base, { employeeId: "fig-odd-c", annualBase: "8.00", ...odd });
      const oddBody = await figures<CountryFigures>(base, odd);
      assert.equal(oddBody.medianAnnualBase, "8.00");
      assert.equal(oddBody.headcount, 3);

      const one = { country: "Singapore", department: "Sales", level: "L6" };
      await create(base, { employeeId: "fig-one", annualBase: "2.50", ...one });
      const oneBody = await figures<CountryFigures>(base, one);
      assert.equal(oneBody.medianAnnualBase, "2.50");
      assert.equal(oneBody.headcount, 1);
      assert.equal(oneBody.totalAnnualBase, "2.50");
    });
  });

  test("a leaver is excluded and a status query does not change the figures", async () => {
    await withApp(async (base) => {
      const slice = { country: "Germany", department: "Finance", level: "L2" };
      await create(base, { employeeId: "fig-active", annualBase: "80.00", ...slice });
      await create(base, {
        employeeId: "fig-left",
        annualBase: "500.00",
        status: "left",
        leaveDate: "2024-05-01",
        ...slice,
      });
      const plain = await figures<CountryFigures>(base, slice);
      const withStatus = await figures<CountryFigures>(base, { ...slice, status: "left" });
      assert.deepEqual(withStatus, plain);
      assert.equal(plain.headcount, 1);
      assert.equal(plain.medianAnnualBase, "80.00");
      assert.equal(plain.totalAnnualBase, "80.00");
      assert.equal(plain.byDepartment.length, 1);
      assert.equal(plain.byLevel.length, 1);
    });
  });

  test("blank department is its own row and headline headcount equals both group sums", async () => {
    await withApp(async (base) => {
      await create(base, { employeeId: "fig-blank", country: "India", department: null, level: "L2", annualBase: "100.00" });
      await create(base, { employeeId: "fig-eng-a", country: "India", department: "Engineering", level: "L1", annualBase: "1.00" });
      await create(base, { employeeId: "fig-eng-b", country: "India", department: "Engineering", level: "L1", annualBase: "2.01" });
      await create(base, { employeeId: "fig-sales", country: "India", department: "Sales", level: "L6", annualBase: "25.00" });
      await create(base, { employeeId: "fig-fin", country: "India", department: "Finance", level: "L3", annualBase: "10.00" });

      const body = await figures<CountryFigures>(base, { country: "India" });
      assert.equal(body.headcount, 5);
      assert.equal(body.totalAnnualBase, "138.01");
      assert.equal(body.medianAnnualBase, "10.00");
      assert.equal(
        body.headcount,
        body.byDepartment.reduce((sum, row) => sum + row.headcount, 0),
      );
      assert.equal(
        body.headcount,
        body.byLevel.reduce((sum, row) => sum + row.headcount, 0),
      );
      assert.deepEqual(
        body.byDepartment.map((row) => [row.department, row.totalAnnualBase, row.headcount]),
        [
          [null, "100.00", 1],
          ["Sales", "25.00", 1],
          ["Finance", "10.00", 1],
          ["Engineering", "3.01", 2],
        ],
      );
      assert.equal(body.byDepartment[3].medianAnnualBase, "1.51");
      assert.deepEqual(
        body.byLevel.map((row) => row.level),
        ["L1", "L2", "L3", "L6"],
      );
      assert.equal(body.byLevel[0].medianAnnualBase, "1.51");
      assert.equal(body.byLevel[0].headcount, 2);
    });
  });

  test("amounts are decimal strings", async () => {
    await withApp(async (base) => {
      const slice = { country: "United States", department: "Operations", level: "L2" };
      await create(base, { employeeId: "fig-usd", annualBase: "10.50", ...slice });
      const body = await figures<CountryFigures>(base, slice);
      assert.equal(body.totalAnnualBase, "10.50");
      assert.equal(body.medianAnnualBase, "10.50");
      assertMoney(body.totalAnnualBase);
      assertMoney(body.medianAnnualBase);
      assertMoney(body.byDepartment[0].totalAnnualBase);
      assertMoney(body.byDepartment[0].medianAnnualBase);
      assertMoney(body.byLevel[0].totalAnnualBase);
      const per = await figures<PerCurrency>(base, { department: "Operations", level: "L2" });
      const usd = per.lines.find((line) => line.currency === "USD");
      assert.ok(usd);
      assert.equal(usd.totalAnnualBase, "10.50");
      assert.equal(typeof usd.totalAnnualBase, "string");
      assert.match(usd.totalAnnualBase, money);
    });
  });
});
