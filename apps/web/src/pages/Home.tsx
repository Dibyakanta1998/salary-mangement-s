import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import {
  PAGE_SIZE,
  fetchFigures,
  fetchPeople,
  filtersFromSearch,
  homeHref,
  type Figures,
  type ListFilters,
  type MoneyGroup,
  type PeoplePage,
} from "../api/client";
import { COPY } from "../copy";
import { formatAmount } from "../formatAmount";
import lookups from "../lookups";
import { navigate } from "../navigate";
import {
  Main,
  Notice,
  PageTitle,
  Shell,
  TableHead,
  cardClass,
  controlClass,
  quietButtonClass,
  tableClass,
  tdClass,
  tdRightClass,
  thClass,
  thRightClass,
  trClass,
} from "../shell";

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
  navigate(href);
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
      key={`${filters.q}|${filters.country}|${filters.department}|${filters.level}|${filters.status}`}
      className="sticky top-14 z-10 border-b border-slate-200 bg-slate-100"
      onChange={onFilterChange}
      onSubmit={onFilterSubmit}
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-2 sm:px-6 lg:grid-cols-5">
        <label className="flex min-w-0 flex-col gap-1">
          <span>{COPY.searchLabel}</span>
          <input
            name="q"
            defaultValue={filters.q}
            className={controlClass}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              const form = event.currentTarget.form;
              if (form) go(homeHref(readForm(form)));
            }}
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
        <label className="flex min-w-0 flex-col gap-1">
          <span>
            {COPY.statusLabel} <span className="text-slate-400">{COPY.statusListNote}</span>
          </span>
          <select name="status" defaultValue={filters.status} className={controlClass}>
            <option value="active">{COPY.statusActive}</option>
            <option value="left">{COPY.statusLeft}</option>
          </select>
        </label>
      </div>
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
    <label className="flex min-w-0 flex-col gap-1">
      <span>{label}</span>
      <select name={name} defaultValue={value} className={controlClass}>
        <option value="">{COPY.any}</option>
        {children}
      </select>
    </label>
  );
}

function moneyOrDash(amount: string | null, currency: string): string {
  if (!amount) return COPY.emDash;
  return formatAmount(amount, currency);
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <article className={`${cardClass} px-4 py-3`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </article>
  );
}

function PerCurrency({ lines }: { lines: Extract<Figures, { kind: "perCurrency" }>["lines"] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {lines.map((line) => (
        <article key={line.currency} className={`${cardClass} px-4 py-3`}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{line.currency}</p>
          <p className="mt-2">
            {COPY.headcount} <span className="font-semibold tabular-nums">{line.headcount}</span>
          </p>
          <p>
            {COPY.totalPay}{" "}
            <span className="font-semibold tabular-nums">{formatAmount(line.totalAnnualBase, line.currency)}</span>
          </p>
        </article>
      ))}
    </div>
  );
}

function GroupTable({
  caption,
  rows,
  currency,
}: {
  caption: string;
  rows: (MoneyGroup & { label: string })[];
  currency: string;
}) {
  return (
    <section className={cardClass}>
      <h2 className="border-b border-slate-200 px-3 py-2 text-sm font-medium">{caption}</h2>
      <div className="overflow-x-auto">
        <table className={tableClass}>
          <TableHead>
            <tr>
              <th className={thClass}>{caption}</th>
              <th className={thRightClass}>{COPY.headcount}</th>
              <th className={thRightClass}>{COPY.median}</th>
              <th className={thRightClass}>{COPY.totalPay}</th>
            </tr>
          </TableHead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className={trClass}>
                <td className={tdClass}>{row.label}</td>
                <td className={tdRightClass}>{row.headcount}</td>
                <td className={tdRightClass}>{moneyOrDash(row.medianAnnualBase, currency)}</td>
                <td className={tdRightClass}>{formatAmount(row.totalAnnualBase, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CountryFigures({
  figures,
  filters,
  people,
}: {
  figures: Extract<Figures, { kind: "country" }>;
  filters: ListFilters;
  people: PeoplePage;
}) {
  const departments = figures.byDepartment.map((row) => ({
    ...row,
    label: row.department ?? COPY.noDepartment,
  }));
  const levels = figures.byLevel.map((row) => ({ ...row, label: row.level }));
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={COPY.headcount} value={String(figures.headcount)} />
        <StatCard label={COPY.median} value={moneyOrDash(figures.medianAnnualBase, figures.currency)} />
        <StatCard label={COPY.totalPay} value={formatAmount(figures.totalAnnualBase, figures.currency)} />
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-[26rem_minmax(0,1fr)]">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <GroupTable caption={COPY.departmentLabel} rows={departments} currency={figures.currency} />
          <GroupTable caption={COPY.levelLabel} rows={levels} currency={figures.currency} />
        </div>
        <PeopleCard filters={filters} people={people} />
      </div>
    </div>
  );
}

function Pager({ filters, page, total }: { filters: ListFilters; page: number; total: number }) {
  const previousHref = page > 1 ? homeHref({ ...filters, page: page - 1 }) : "";
  const nextHref = page * PAGE_SIZE < total ? homeHref({ ...filters, page: page + 1 }) : "";
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-3 py-3">
      <span>
        {COPY.totalLabel} {total}
      </span>
      <span>
        {COPY.pageLabel} {page}
      </span>
      {previousHref ? (
        <a className={quietButtonClass} href={previousHref}>
          {COPY.previous}
        </a>
      ) : (
        <button type="button" className={quietButtonClass} disabled>
          {COPY.previous}
        </button>
      )}
      {nextHref ? (
        <a className={quietButtonClass} href={nextHref}>
          {COPY.next}
        </a>
      ) : (
        <button type="button" className={quietButtonClass} disabled>
          {COPY.next}
        </button>
      )}
    </div>
  );
}

function statusLabel(status: string): string {
  if (status === "left") return COPY.statusLeft;
  if (status === "active") return COPY.statusActive;
  return status;
}

function StatusPill({ status }: { status: string }) {
  const tone = status === "left" ? "bg-slate-200 text-slate-700" : "bg-slate-900 text-white";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{statusLabel(status)}</span>
  );
}

function PeopleTable({ people }: { people: PeoplePage }) {
  if (people.people.length === 0) return <p className="px-3 py-4">{COPY.empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className={tableClass}>
        <TableHead>
          <tr>
            <th className={thClass}>{COPY.columnEmployee}</th>
            <th className={thClass}>{COPY.columnCountry}</th>
            <th className={thClass}>{COPY.columnLevel}</th>
            <th className={thClass}>{COPY.columnDepartment}</th>
            <th className={thRightClass}>{COPY.columnBase}</th>
            <th className={thClass}>{COPY.columnStatus}</th>
          </tr>
        </TableHead>
        <tbody>
          {people.people.map((person) => (
            <tr key={person.employeeId} className={trClass}>
              <td className={tdClass}>
                <a
                  className="block text-slate-900 no-underline"
                  href={`/people?id=${encodeURIComponent(person.employeeId)}`}
                >
                  <span className="block font-mono text-xs">{person.employeeId}</span>
                  <span className="block">{person.legalName}</span>
                </a>
              </td>
              <td className={tdClass}>{person.country}</td>
              <td className={tdClass}>{person.level}</td>
              <td className={tdClass}>{person.department ?? COPY.noDepartment}</td>
              <td className={tdRightClass}>{formatAmount(person.annualBase, person.currency)}</td>
              <td className={tdClass}>
                <StatusPill status={person.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PeopleCard({ filters, people }: { filters: ListFilters; people: PeoplePage }) {
  return (
    <section className={cardClass}>
      <Pager filters={filters} page={people.page} total={people.total} />
      <PeopleTable people={people} />
    </section>
  );
}

function useHomeData(filters: ListFilters): { load: Load; retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [load, setLoad] = useState<Load>({ phase: "loading" });
  const { q, country, department, level, status, page } = filters;

  useEffect(() => {
    const controller = new AbortController();
    const query = { q, country, department, level, status, page };
    setLoad((current) => (current.phase === "ready" ? current : { phase: "loading" }));
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
    <Shell>
      <FilterBar filters={filters} />
      <Main>
        <PageTitle>{COPY.title}</PageTitle>
        {load.phase === "loading" ? <Notice>{COPY.loading}</Notice> : null}
        {load.phase === "error" ? (
          <Notice>
            {COPY.loadError}{" "}
            <button type="button" className={quietButtonClass} onClick={retry}>
              {COPY.retry}
            </button>
          </Notice>
        ) : null}
        {load.phase === "ready" && load.figures.kind === "perCurrency" ? (
          <div className="space-y-4">
            <PerCurrency lines={load.figures.lines} />
            <PeopleCard filters={filters} people={load.people} />
          </div>
        ) : null}
        {load.phase === "ready" && load.figures.kind === "country" ? (
          <CountryFigures figures={load.figures} filters={filters} people={load.people} />
        ) : null}
      </Main>
    </Shell>
  );
}
