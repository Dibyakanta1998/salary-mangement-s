import { useEffect, useState } from "react";
import { fetchChanges, type ChangeRow } from "../api/client";
import { COPY } from "../copy";
import { formatAmount } from "../formatAmount";
import {
  Main,
  Notice,
  PageTitle,
  Shell,
  TableHead,
  cardClass,
  quietButtonClass,
  tableClass,
  tdClass,
  tdRightClass,
  thClass,
  thRightClass,
  trClass,
} from "../shell";
import { currencyFor } from "./personForm";

type Load = { phase: "loading" } | { phase: "error" } | { phase: "ready"; rows: ChangeRow[] };

function changeDate(changedAt: string): string {
  return changedAt.slice(0, 10);
}

function oldCurrency(row: ChangeRow): string {
  return currencyFor(row.oldCountry ?? row.newCountry);
}

function ChangesTable({ rows }: { rows: ChangeRow[] }) {
  if (rows.length === 0) return <Notice>{COPY.changesEmpty}</Notice>;
  return (
    <div className={`${cardClass} overflow-x-auto`}>
      <table className={tableClass}>
        <TableHead>
          <tr>
            <th className={thClass}>{COPY.columnPerson}</th>
            <th className={thRightClass}>{COPY.columnOldBase}</th>
            <th className={thRightClass}>{COPY.columnNewBase}</th>
            <th className={thClass}>{COPY.columnOldCountry}</th>
            <th className={thClass}>{COPY.columnDate}</th>
            <th className={thClass}>{COPY.columnNote}</th>
          </tr>
        </TableHead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.employeeId}-${row.changedAt}`} className={trClass}>
              <td className={tdClass}>
                <span className="block font-mono text-xs">{row.employeeId}</span>
                <span className="block">{row.legalName}</span>
              </td>
              <td className={tdRightClass}>{formatAmount(row.oldBase, oldCurrency(row))}</td>
              <td className={tdRightClass}>{formatAmount(row.newBase, currencyFor(row.newCountry))}</td>
              <td className={tdClass}>{row.oldCountry ?? ""}</td>
              <td className={tdClass}>{changeDate(row.changedAt)}</td>
              <td className={tdClass}>{row.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
    <Shell>
      <Main>
        <PageTitle>{COPY.changesTitle}</PageTitle>
        {load.phase === "loading" ? <Notice>{COPY.changesLoading}</Notice> : null}
        {load.phase === "error" ? (
          <Notice>
            {COPY.changesLoadError}{" "}
            <button type="button" className={quietButtonClass} onClick={retry}>
              {COPY.retry}
            </button>
          </Notice>
        ) : null}
        {load.phase === "ready" ? <ChangesTable rows={load.rows} /> : null}
      </Main>
    </Shell>
  );
}
