import { type FormEvent, useEffect, useState } from "react";
import {
  ApiError,
  deleteBand,
  fetchBands,
  fetchOutside,
  saveBand,
  type BandRow,
  type OutsideRow,
} from "../api/client";
import { COPY } from "../copy";
import { formatAmount } from "../formatAmount";
import lookups from "../lookups";
import {
  Main,
  Notice,
  PageTitle,
  Shell,
  TableHead,
  cardClass,
  controlClass,
  primaryButtonClass,
  quietButtonClass,
  tableClass,
  tdClass,
  tdRightClass,
  thClass,
  thRightClass,
  trClass,
} from "../shell";
import { currencyFor } from "./personForm";

type Cell = { country: string; level: string };
type Load = { phase: "loading" } | { phase: "error" } | { phase: "ready"; bands: BandRow[] };
type OutsideLoad =
  | { phase: "hidden" }
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "ready"; rows: OutsideRow[] };
type CellError = { country: string; level: string; message: string };

function bandKey(country: string, level: string): string {
  return `${country}\t${level}`;
}

function sameCell(left: Cell | null, right: Cell): boolean {
  return left?.country === right.country && left.level === right.level;
}

function bandLabel(band: BandRow | undefined): string {
  if (!band) return COPY.noBand;
  return `${formatAmount(band.minBase, band.currency)} – ${formatAmount(band.maxBase, band.currency)}`;
}

function sideLabel(side: OutsideRow["side"]): string {
  return side === "under" ? COPY.sideUnder : COPY.sideOver;
}

function messageFrom(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.message) return error.message;
  return fallback;
}

function useBands(attempt: number): Load {
  const [load, setLoad] = useState<Load>({ phase: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setLoad((current) => (current.phase === "ready" ? current : { phase: "loading" }));
    fetchBands(controller.signal)
      .then((bands) => {
        if (!controller.signal.aborted) setLoad({ phase: "ready", bands });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (!controller.signal.aborted) setLoad({ phase: "error" });
      });
    return () => controller.abort();
  }, [attempt]);

  return load;
}

function useOutside(open: Cell | null, band: BandRow | undefined, attempt: number): OutsideLoad {
  const [outside, setOutside] = useState<OutsideLoad>({ phase: "hidden" });
  const country = open?.country ?? "";
  const level = open?.level ?? "";
  const minBase = band?.minBase ?? "";
  const maxBase = band?.maxBase ?? "";

  useEffect(() => {
    if (!country || !level || !minBase) {
      setOutside({ phase: "hidden" });
      return;
    }
    const controller = new AbortController();
    setOutside({ phase: "loading" });
    fetchOutside(country, level, controller.signal)
      .then((rows) => {
        if (!controller.signal.aborted) setOutside({ phase: "ready", rows });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (!controller.signal.aborted) setOutside({ phase: "error" });
      });
    return () => controller.abort();
  }, [attempt, country, level, minBase, maxBase]);

  return outside;
}

function OutsideTable({ rows, currency }: { rows: OutsideRow[]; currency: string }) {
  if (rows.length === 0) return <Notice>{COPY.outsideEmpty}</Notice>;
  return (
    <div className={`${cardClass} overflow-x-auto`}>
      <table className={tableClass}>
        <TableHead>
          <tr>
            <th className={thClass}>{COPY.columnPerson}</th>
            <th className={thRightClass}>{COPY.columnBase}</th>
            <th className={thRightClass}>{COPY.columnMin}</th>
            <th className={thRightClass}>{COPY.columnMax}</th>
            <th className={thRightClass}>{COPY.columnGap}</th>
            <th className={thClass}>{COPY.columnSide}</th>
          </tr>
        </TableHead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.employeeId} className={trClass}>
              <td className={tdClass}>
                <span className="block font-mono text-xs">{row.employeeId}</span>
                <span className="block">{row.legalName}</span>
              </td>
              <td className={tdRightClass}>{formatAmount(row.base, currency)}</td>
              <td className={tdRightClass}>{formatAmount(row.min, currency)}</td>
              <td className={tdRightClass}>{formatAmount(row.max, currency)}</td>
              <td className={tdRightClass}>{formatAmount(row.gap, currency)}</td>
              <td className={tdClass}>{sideLabel(row.side)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BandEditor({
  cell,
  band,
  busy,
  error,
  onSet,
  onClear,
}: {
  cell: Cell;
  band: BandRow | undefined;
  busy: boolean;
  error: string;
  onSet: (cell: Cell, minBase: string, maxBase: string) => void;
  onClear: (cell: Cell) => void;
}) {
  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSet(cell, String(data.get("minBase") ?? "").trim(), String(data.get("maxBase") ?? "").trim());
  }

  return (
    <section className={`${cardClass} p-4`}>
      <p className="mb-3 font-medium">
        {cell.country} · {cell.level} · {currencyFor(cell.country)}
      </p>
      <form className="flex flex-wrap items-end gap-3" onSubmit={onSubmit}>
        <label className="flex w-40 flex-col gap-1">
          <span>{COPY.minBaseLabel}</span>
          <input name="minBase" required inputMode="decimal" className={controlClass} />
        </label>
        <label className="flex w-40 flex-col gap-1">
          <span>{COPY.maxBaseLabel}</span>
          <input name="maxBase" required inputMode="decimal" className={controlClass} />
        </label>
        <button type="submit" disabled={busy} className={primaryButtonClass}>
          {busy ? COPY.saving : COPY.setBand}
        </button>
        {band ? (
          <button type="button" disabled={busy} className={quietButtonClass} onClick={() => onClear(cell)}>
            {COPY.clearBand}
          </button>
        ) : null}
      </form>
      {error ? (
        <p className="mt-3" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

export function Bands() {
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<Cell | null>(null);
  const [busyKey, setBusyKey] = useState("");
  const [cellError, setCellError] = useState<CellError | null>(null);
  const load = useBands(attempt);
  const bands = load.phase === "ready" ? load.bands : [];
  const byKey = new Map(bands.map((band) => [bandKey(band.country, band.level), band]));
  const selectedBand = selected ? byKey.get(bandKey(selected.country, selected.level)) : undefined;
  const outside = useOutside(selectedBand ? selected : null, selectedBand, attempt);
  const editorError =
    selected && cellError && sameCell(selected, cellError) ? cellError.message : "";

  async function onSet(cell: Cell, minBase: string, maxBase: string): Promise<void> {
    setBusyKey(bandKey(cell.country, cell.level));
    setCellError(null);
    try {
      await saveBand(cell.country, cell.level, { minBase, maxBase });
      setSelected(cell);
      setAttempt((value) => value + 1);
    } catch (error: unknown) {
      setCellError({ ...cell, message: messageFrom(error, COPY.bandSaveError) });
    } finally {
      setBusyKey("");
    }
  }

  async function onClear(cell: Cell): Promise<void> {
    setBusyKey(bandKey(cell.country, cell.level));
    setCellError(null);
    try {
      await deleteBand(cell.country, cell.level);
      setAttempt((value) => value + 1);
    } catch (error: unknown) {
      setCellError({ ...cell, message: messageFrom(error, COPY.bandClearError) });
    } finally {
      setBusyKey("");
    }
  }

  return (
    <Shell>
      <Main>
        <PageTitle>{COPY.bandsTitle}</PageTitle>
        {load.phase === "loading" ? <Notice>{COPY.bandsLoading}</Notice> : null}
        {load.phase === "error" ? (
          <Notice>
            {COPY.bandsLoadError}{" "}
            <button type="button" className={quietButtonClass} onClick={() => setAttempt((value) => value + 1)}>
              {COPY.retry}
            </button>
          </Notice>
        ) : null}
        {load.phase === "ready" ? (
          <div className="space-y-4">
            <div className={`${cardClass} overflow-x-auto`}>
              <table className={tableClass}>
                <TableHead>
                  <tr>
                    <th className={thClass}>{COPY.countryLabel}</th>
                    {lookups.levels.map((level) => (
                      <th key={level} className={thClass}>
                        {level}
                      </th>
                    ))}
                  </tr>
                </TableHead>
                <tbody>
                  {lookups.countries.map((country) => (
                    <tr key={country.name} className={trClass}>
                      <th scope="row" className={`${tdClass} text-left font-medium`}>
                        {country.name}
                      </th>
                      {lookups.levels.map((level) => {
                        const cell = { country: country.name, level };
                        const band = byKey.get(bandKey(cell.country, cell.level));
                        const active = sameCell(selected, cell);
                        return (
                          <td key={level} className="p-1">
                            <button
                              type="button"
                              aria-pressed={active}
                              className={`w-full rounded-md px-2 py-2 text-left text-xs ${
                                active ? "ring-2 ring-sky-600" : "hover:bg-slate-50"
                              } ${band ? "" : "text-slate-500"}`}
                              onClick={() => setSelected(cell)}
                            >
                              {bandLabel(band)}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selected ? (
              <BandEditor
                key={bandKey(selected.country, selected.level)}
                cell={selected}
                band={selectedBand}
                busy={busyKey === bandKey(selected.country, selected.level)}
                error={editorError}
                onSet={(cell, minBase, maxBase) => void onSet(cell, minBase, maxBase)}
                onClear={(cell) => void onClear(cell)}
              />
            ) : null}
            {selectedBand && outside.phase === "loading" ? <Notice>{COPY.outsideLoading}</Notice> : null}
            {selectedBand && outside.phase === "error" ? (
              <Notice>
                {COPY.outsideLoadError}{" "}
                <button type="button" className={quietButtonClass} onClick={() => setAttempt((value) => value + 1)}>
                  {COPY.retry}
                </button>
              </Notice>
            ) : null}
            {selectedBand && outside.phase === "ready" ? (
              <OutsideTable rows={outside.rows} currency={selectedBand.currency} />
            ) : null}
          </div>
        ) : null}
      </Main>
    </Shell>
  );
}
