import { useEffect, useState } from "react";
import { fetchChanges, type ChangeRow } from "../api/client";
import { COPY } from "../copy";
import { formatAmount } from "../formatAmount";
import { currencyFor } from "./personForm";

type Load = { phase: "loading" } | { phase: "error" } | { phase: "ready"; rows: ChangeRow[] };

function changeDate(changedAt: string): string {
  return changedAt.slice(0, 10);
}

function oldCurrency(row: ChangeRow): string {
  return currencyFor(row.oldCountry ?? row.newCountry);
}

function ChangesTable({ rows }: { rows: ChangeRow[] }) {
  if (rows.length === 0) return <p>{COPY.changesEmpty}</p>;
  return (
    <table className="w-full border-collapse text-left text-sm">
      <thead>
        <tr className="border-b border-slate-200">
          <th className="py-2 pr-3">{COPY.columnPerson}</th>
          <th className="py-2 pr-3">{COPY.columnOldBase}</th>
          <th className="py-2 pr-3">{COPY.columnNewBase}</th>
          <th className="py-2 pr-3">{COPY.columnOldCountry}</th>
          <th className="py-2 pr-3">{COPY.columnDate}</th>
          <th className="py-2">{COPY.columnNote}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={`${row.employeeId}-${row.changedAt}`} className="border-b border-slate-100">
            <td className="py-2 pr-3">
              {row.legalName} {row.employeeId}
            </td>
            <td className="py-2 pr-3">{formatAmount(row.oldBase, oldCurrency(row))}</td>
            <td className="py-2 pr-3">{formatAmount(row.newBase, currencyFor(row.newCountry))}</td>
            <td className="py-2 pr-3">{row.oldCountry ?? ""}</td>
            <td className="py-2 pr-3">{changeDate(row.changedAt)}</td>
            <td className="py-2">{row.note}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function useChanges(): { load: Load; retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [load, setLoad] = useState<Load>({ phase: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setLoad({ phase: "loading" });
    fetchChanges(controller.signal)
      .then((rows) => {
        if (!controller.signal.aborted) setLoad({ phase: "ready", rows });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (!controller.signal.aborted) setLoad({ phase: "error" });
      });
    return () => controller.abort();
  }, [attempt]);

  return { load, retry: () => setAttempt((value) => value + 1) };
}

export function Changes() {
  const { load, retry } = useChanges();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between px-4 py-3">
        <a className="text-blue-700 underline" href="/">
          {COPY.title}
        </a>
        <h1 className="text-xl font-semibold">{COPY.changesTitle}</h1>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-4">
        {load.phase === "loading" ? <p>{COPY.changesLoading}</p> : null}
        {load.phase === "error" ? (
          <p>
            {COPY.changesLoadError}{" "}
            <button type="button" className="text-blue-700 underline" onClick={retry}>
              {COPY.retry}
            </button>
          </p>
        ) : null}
        {load.phase === "ready" ? <ChangesTable rows={load.rows} /> : null}
      </main>
    </div>
  );
}
