export const PAGE_SIZE = 50;

export type ListFilters = {
  q: string;
  country: string;
  department: string;
  level: string;
  status: string;
  page: number;
};

export type PersonRow = {
  employeeId: string;
  legalName: string;
  country: string;
  currency: string;
  level: string;
  annualBase: string;
  status: string;
  department: string | null;
};

export type PeoplePage = {
  page: number;
  pageSize: number;
  total: number;
  people: PersonRow[];
};

export type MoneyGroup = {
  headcount: number;
  medianAnnualBase: string | null;
  totalAnnualBase: string;
};

export type Figures =
  | {
      kind: "perCurrency";
      lines: { currency: string; headcount: number; totalAnnualBase: string }[];
    }
  | {
      kind: "country";
      country: string;
      currency: string;
      headcount: number;
      medianAnnualBase: string | null;
      totalAnnualBase: string;
      byDepartment: (MoneyGroup & { department: string | null })[];
      byLevel: (MoneyGroup & { level: string })[];
    };

function appendIf(params: URLSearchParams, key: string, value: string): void {
  if (value) params.set(key, value);
}

export function filtersFromSearch(search: string): ListFilters {
  const params = new URLSearchParams(search);
  const pageRaw = Number(params.get("page"));
  const status = params.get("status");
  return {
    q: (params.get("q") ?? "").trim(),
    country: params.get("country") ?? "",
    department: params.get("department") ?? "",
    level: params.get("level") ?? "",
    status: status === "left" ? "left" : "active",
    page: Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1,
  };
}

export function homeHref(filters: ListFilters): string {
  const params = new URLSearchParams();
  appendIf(params, "q", filters.q.trim());
  appendIf(params, "country", filters.country);
  appendIf(params, "department", filters.department);
  appendIf(params, "level", filters.level);
  if (filters.status === "left") params.set("status", "left");
  if (filters.page > 1) params.set("page", String(filters.page));
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

/** Country, department, and level only. Status is never sent. */
export function figuresQuery(filters: {
  country: string;
  department: string;
  level: string;
}): string {
  const params = new URLSearchParams();
  appendIf(params, "country", filters.country);
  appendIf(params, "department", filters.department);
  appendIf(params, "level", filters.level);
  const qs = params.toString();
  return qs ? `/api/figures?${qs}` : "/api/figures";
}

export function peopleQuery(filters: ListFilters): string {
  const params = new URLSearchParams();
  appendIf(params, "q", filters.q.trim());
  appendIf(params, "country", filters.country);
  appendIf(params, "department", filters.department);
  appendIf(params, "level", filters.level);
  params.set("status", filters.status === "left" ? "left" : "active");
  params.set("page", String(filters.page > 0 ? filters.page : 1));
  params.set("pageSize", String(PAGE_SIZE));
  return `/api/people?${params.toString()}`;
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal });
  if (!response.ok) throw new Error(String(response.status));
  return response.json() as Promise<T>;
}

export function fetchPeople(filters: ListFilters, signal?: AbortSignal): Promise<PeoplePage> {
  return getJson<PeoplePage>(peopleQuery(filters), signal);
}

export function fetchFigures(
  filters: { country: string; department: string; level: string },
  signal?: AbortSignal,
): Promise<Figures> {
  return getJson<Figures>(figuresQuery(filters), signal);
}
