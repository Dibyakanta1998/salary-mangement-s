import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { Figures, PersonDetail } from "./api/client";
import { Home } from "./pages/Home";
import { Person } from "./pages/Person";

const peoplePage = { page: 1, pageSize: 50, total: 0, people: [] };

const perCurrency: Figures = {
  kind: "perCurrency",
  lines: [{ currency: "SGD", headcount: 2, totalAnnualBase: "10.00" }],
};

const countryFigures: Figures = {
  kind: "country",
  country: "India",
  currency: "INR",
  headcount: 1,
  medianAnnualBase: "42.50",
  totalAnnualBase: "99.00",
  byDepartment: [],
  byLevel: [],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stubFetch(payload: (url: string) => unknown): string[] {
  const urls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      urls.push(url);
      return Promise.resolve(
        new Response(JSON.stringify(payload(url)), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    }),
  );
  return urls;
}

test("figures request does not include status", async () => {
  window.history.replaceState(null, "", "/?status=left&country=India&department=Engineering&level=L1");
  const urls = stubFetch((url) => (url.startsWith("/api/figures") ? perCurrency : peoplePage));
  render(<Home />);
  await screen.findByRole("heading", { name: "Pay figures" });
  const figuresUrls = urls.filter((url) => url.startsWith("/api/figures"));
  expect(figuresUrls.length).toBeGreaterThan(0);
  for (const figuresUrl of figuresUrls) {
    const params = new URL(figuresUrl, "http://localhost").searchParams;
    expect(params.has("status")).toBe(false);
    expect(params.get("country")).toBe("India");
    expect(params.get("department")).toBe("Engineering");
    expect(params.get("level")).toBe("L1");
  }
});

test("perCurrency payload hides median and breakdown tables", async () => {
  window.history.replaceState(null, "", "/?status=left");
  stubFetch((url) => (url.startsWith("/api/figures") ? perCurrency : peoplePage));
  const view = render(<Home />);
  await screen.findByText(/SGD/);
  expect(screen.queryByText("Median")).toBeNull();
  expect(screen.queryByRole("table", { name: "Department" })).toBeNull();
  expect(screen.queryByRole("table", { name: "Level" })).toBeNull();
  view.unmount();

  stubFetch((url) => (url.startsWith("/api/figures") ? countryFigures : peoplePage));
  render(<Home />);
  expect((await screen.findByText(/42\.50 INR/)).textContent).toContain("42.50");
});

test("monthly pay is rendered from monthlyBase", async () => {
  const person: PersonDetail = {
    employeeId: "E1",
    legalName: "Ada",
    country: "India",
    currency: "INR",
    level: "L1",
    annualBase: "1.00",
    status: "active",
    department: null,
    managerEmployeeId: null,
    startDate: null,
    leaveDate: null,
    monthlyBase: "8333.33",
    lastChangeAt: null,
    lastNote: null,
    history: [],
  };
  stubFetch(() => person);
  render(<Person employeeId="E1" />);
  const line = await screen.findByText(/Monthly/);
  const text = line.textContent?.replaceAll(",", "") ?? "";
  expect(text).toContain("8333.33");
  expect(text).toContain("INR");
});
