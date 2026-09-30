import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import {
  fetchFigures,
  fetchPeople,
  filtersFromSearch,
  homeHref,
  type Figures,
  type ListFilters,
  type PeoplePage,
} from "../api/client";
import { COPY } from "../copy";
import { formatAmount } from "../formatAmount";
import lookups from "../lookups";

type Load =
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "ready"; people: PeoplePage; figures: Figures };

function readForm(form: HTMLFormElement): ListFilters {
  const data = new FormData(form);
  const status = String(data.get("status") ?? "");
  return {
    q: String(data.get("q") ?? "").trim(),
    country: String(data.get("country") ?? ""),
    department: String(data.get("department") ?? ""),
    level: String(data.get("level") ?? ""),
    status: status === "left" ? "left" : "active",
    page: 1,
  };
}

function go(href: string): void {
  const current = `${window.location.pathname}${window.location.search}`;
  if (href !== current) window.location.assign(href);
}

function onFilterChange(event: FormEvent<HTMLFormElement>): void {
  if (event.target instanceof HTMLInputElement) return;
  go(homeHref(readForm(event.currentTarget)));
}

function onFilterSubmit(event: FormEvent<HTMLFormElement>): void {
  event.preventDefault();
  go(homeHref(readForm(event.currentTarget)));
}

function FilterBar({ filters }: { filters: ListFilters }) {
  return (
    <form
      className="sticky top-0 z-10 flex flex-wrap items-end gap-3 border-b border-slate-200 bg-white px-4 py-3"
      onChange={onFilterChange}
      onSubmit={onFilterSubmit}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span>{COPY.searchLabel}</span>
        <input
          name="q"
          defaultValue={filters.q}
          className="rounded border border-slate-300 px-2 py-1"
        />
      </label>
      <SelectFilter name="country" label={COPY.countryLabel} value={filters.country}>
        {lookups.countries.map((country) => (
          <option key={country.name} value={country.name}>
            {country.name}
          </option>
        ))}
      </SelectFilter>
      <SelectFilter name="department" label={COPY.departmentLabel} value={filters.department}>
        {lookups.departments.map((department) => (
          <option key={department} value={department}>
            {department}
          </option>
        ))}
      </SelectFilter>
      <SelectFilter name="level" label={COPY.levelLabel} value={filters.level}>
        {lookups.levels.map((level) => (
          <option key={level} value={level}>
            {level}
          </option>
        ))}
      </SelectFilter>
      <label className="flex flex-col gap-1 text-sm">
        <span>{COPY.statusLabel}</span>
        <select
          name="status"
          defaultValue={filters.status}
          className="rounded border border-slate-300 px-2 py-1"
        >
          <option value="active">{COPY.statusActive}</option>
          <option value="left">{COPY.statusLeft}</option>
        </select>
      </label>
      <button type="submit" className="rounded bg-slate-900 px-3 py-1 text-sm text-white">
        {COPY.searchLabel}
      </button>
    </form>
  );
}

function SelectFilter({
  name,
  label,
  value,
  children,
}: {
  name: string;
  label: string;
  value: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span>{label}</span>
      <select name={name} defaultValue={value} className="rounded border border-slate-300 px-2 py-1">
        <option value="">{COPY.any}</option>
        {children}
      </select>
    </label>
  );
}

function amountOrBlank(amount: string | null, currency: string): string {
  if (!amount) return "";
  return formatAmount(amount, currency);
}

function PerCurrency({ lines }: { lines: Extract<Figures, { kind: "perCurrency" }>["lines"] }) {
  return (
    <ul className="space-y-1">
      {lines.map((line) => (
        <li key={line.currency}>
          {line.currency} {COPY.headcount} {line.headcount} {COPY.totalPay}{" "}
          {formatAmount(line.totalAnnualBase, line.currency)}
        </li>
      ))}
    </ul>
  );
}

function GroupTable({
  caption,
  labelKey,
  rows,
  currency,
}: {
  caption: string;
  labelKey: "department" | "level";
  rows: ({ headcount: number; medianAnnualBase: string | null; totalAnnualBase: string } & {
    department?: string | null;
    level?: string;
  })[];
  currency: string;
}) {
  return (
    <table className="mt-4 w-full border-collapse text-left text-sm">
      <caption className="mb-2 text-left font-medium">{caption}</caption>
      <thead>
        <tr className="border-b border-slate-200">
          <th className="py-1 pr-3">{caption}</th>
          <th className="py-1 pr-3">{COPY.headcount}</th>
          <th className="py-1 pr-3">{COPY.median}</th>
          <th className="py-1">{COPY.totalPay}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const label =
            labelKey === "department" ? (row.department ?? COPY.noDepartment) : (row.level ?? "");
          return (
            <tr key={label} className="border-b border-slate-100">
              <td className="py-1 pr-3">{label}</td>
              <td className="py-1 pr-3">{row.headcount}</td>
              <td className="py-1 pr-3">{amountOrBlank(row.medianAnnualBase, currency)}</td>
              <td className="py-1">{formatAmount(row.totalAnnualBase, currency)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function CountryFigures({ figures }: { figures: Extract<Figures, { kind: "country" }> }) {
  return (
    <div>
      <p>
        {COPY.headcount} {figures.headcount}
      </p>
      <p>
        {COPY.median} {amountOrBlank(figures.medianAnnualBase, figures.currency)}
      </p>
      <p>
        {COPY.totalPay} {formatAmount(figures.totalAnnualBase, figures.currency)}
      </p>
      <GroupTable
        caption={COPY.departmentLabel}
        labelKey="department"
        rows={figures.byDepartment}
        currency={figures.currency}
      />
      <GroupTable
        caption={COPY.levelLabel}
        labelKey="level"
        rows={figures.byLevel}
        currency={figures.currency}
      />
    </div>
  );
}

function FiguresPanel({ figures }: { figures: Figures }) {
  return (
    <section className="px-4 py-4">
      <h2 className="mb-2 text-lg font-medium">{COPY.figuresTitle}</h2>
      {figures.kind === "perCurrency" ? (
        <PerCurrency lines={figures.lines} />
      ) : (
        <CountryFigures figures={figures} />
      )}
    </section>
  );
}

function Pager({ filters, page, total }: { filters: ListFilters; page: number; total: number }) {
  const pageSize = 50;
  return (
    <p className="flex flex-wrap items-center gap-3 text-sm">
      <span>
        {COPY.pageLabel} {page}
      </span>
      <span>
        {COPY.totalLabel} {total}
      </span>
      {page > 1 ? (
        <a className="text-blue-700 underline" href={homeHref({ ...filters, page: page - 1 })}>
          {COPY.previous}
        </a>
      ) : (
        <span>{COPY.previous}</span>
      )}
      {page * pageSize < total ? (
        <a className="text-blue-700 underline" href={homeHref({ ...filters, page: page + 1 })}>
          {COPY.next}
        </a>
      ) : (
        <span>{COPY.next}</span>
      )}
    </p>
  );
}

function statusLabel(status: string): string {
  if (status === "left") return COPY.statusLeft;
  if (status === "active") return COPY.statusActive;
  return status;
}

function PeopleTable({ people }: { people: PeoplePage }) {
  if (people.people.length === 0) return <p>{COPY.empty}</p>;
  return (
    <table className="w-full border-collapse text-left text-sm">
      <thead>
        <tr className="border-b border-slate-200">
          <th className="py-2 pr-3">{COPY.columnEmployee}</th>
          <th className="py-2 pr-3">{COPY.columnCountry}</th>
          <th className="py-2 pr-3">{COPY.columnLevel}</th>
          <th className="py-2 pr-3">{COPY.columnDepartment}</th>
          <th className="py-2 pr-3">{COPY.columnBase}</th>
          <th className="py-2">{COPY.columnStatus}</th>
        </tr>
      </thead>
      <tbody>
        {people.people.map((person) => (
          <tr key={person.employeeId} className="border-b border-slate-100">
            <td className="py-2 pr-3">
              <a
                className="text-blue-700 underline"
                href={`/people?id=${encodeURIComponent(person.employeeId)}`}
              >
                {person.employeeId} {person.legalName}
              </a>
            </td>
            <td className="py-2 pr-3">{person.country}</td>
            <td className="py-2 pr-3">{person.level}</td>
            <td className="py-2 pr-3">{person.department ?? COPY.noDepartment}</td>
            <td className="py-2 pr-3">{formatAmount(person.annualBase, person.currency)}</td>
            <td className="py-2">{statusLabel(person.status)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function useHomeData(filters: ListFilters): { load: Load; retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [load, setLoad] = useState<Load>({ phase: "loading" });
  const { q, country, department, level, status, page } = filters;

  useEffect(() => {
    const controller = new AbortController();
    const query = { q, country, department, level, status, page };
    setLoad({ phase: "loading" });
    Promise.all([
      fetchPeople(query, controller.signal),
      fetchFigures({ country, department, level }, controller.signal),
    ])
      .then(([people, figures]) => {
        if (!controller.signal.aborted) setLoad({ phase: "ready", people, figures });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (!controller.signal.aborted) setLoad({ phase: "error" });
      });
    return () => controller.abort();
  }, [attempt, q, country, department, level, status, page]);

  return { load, retry: () => setAttempt((value) => value + 1) };
}

export function Home() {
  const filters = filtersFromSearch(window.location.search);
  const { load, retry } = useHomeData(filters);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between px-4 py-3">
        <h1 className="text-xl font-semibold">{COPY.title}</h1>
        <a className="text-blue-700 underline" href="/people/new">
          {COPY.add}
        </a>
      </header>
      <FilterBar filters={filters} />
      <main className="mx-auto max-w-6xl">
        {load.phase === "loading" ? <p className="px-4 py-4">{COPY.loading}</p> : null}
        {load.phase === "error" ? (
          <p className="px-4 py-4">
            {COPY.loadError}{" "}
            <button type="button" className="text-blue-700 underline" onClick={retry}>
              {COPY.retry}
            </button>
          </p>
        ) : null}
        {load.phase === "ready" ? (
          <>
            <FiguresPanel figures={load.figures} />
            <section className="space-y-3 px-4 pb-8">
              <Pager filters={filters} page={load.people.page} total={load.people.total} />
              <PeopleTable people={load.people} />
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
