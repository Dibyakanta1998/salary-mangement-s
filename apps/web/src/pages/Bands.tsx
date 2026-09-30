import { Fragment, type FormEvent, useEffect, useState } from "react";
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

type Cell = { country: string; level: string };
type Load = { phase: "loading" } | { phase: "error" } | { phase: "ready"; bands: BandRow[] };
type OutsideLoad =
  | { phase: "hidden" }
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "ready"; rows: OutsideRow[] };
type CellError = { country: string; level: string; message: string };

const controlClass = "rounded border border-slate-300 px-2 py-1";

function bandKey(country: string, level: string): string {
  return `${country}\t${level}`;
}

function allCells(): Cell[] {
  return lookups.countries.flatMap((country) => lookups.levels.map((level) => ({ country: country.name, level })));
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
  if (rows.length === 0) return <p>{COPY.outsideEmpty}</p>;
  return (
    <table className="w-full border-collapse text-left text-sm">
      <thead>
        <tr className="border-b border-slate-200">
          <th className="py-2 pr-3">{COPY.columnPerson}</th>
          <th className="py-2 pr-3">{COPY.columnBase}</th>
          <th className="py-2 pr-3">{COPY.columnMin}</th>
          <th className="py-2 pr-3">{COPY.columnMax}</th>
          <th className="py-2 pr-3">{COPY.columnGap}</th>
          <th className="py-2">{COPY.columnSide}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.employeeId} className="border-b border-slate-100">
            <td className="py-2 pr-3">
              {row.legalName} {row.employeeId}
            </td>
            <td className="py-2 pr-3">{formatAmount(row.base, currency)}</td>
            <td className="py-2 pr-3">{formatAmount(row.min, currency)}</td>
            <td className="py-2 pr-3">{formatAmount(row.max, currency)}</td>
            <td className="py-2 pr-3">{formatAmount(row.gap, currency)}</td>
            <td className="py-2">{sideLabel(row.side)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BandActions({
  cell,
  band,
  busy,
  error,
  onSet,
  onClear,
  onOpen,
}: {
  cell: Cell;
  band: BandRow | undefined;
  busy: boolean;
  error: string;
  onSet: (cell: Cell, minBase: string, maxBase: string) => void;
  onClear: (cell: Cell) => void;
  onOpen: (cell: Cell) => void;
}) {
  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSet(cell, String(data.get("minBase") ?? "").trim(), String(data.get("maxBase") ?? "").trim());
  }

  return (
    <div className="space-y-2">
      <form className="flex flex-wrap items-end gap-2" onSubmit={onSubmit}>
        <label className="flex flex-col gap-1 text-sm">
          <span>{COPY.minBaseLabel}</span>
          <input name="minBase" required inputMode="decimal" className={controlClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>{COPY.maxBaseLabel}</span>
          <input name="maxBase" required inputMode="decimal" className={controlClass} />
        </label>
        <button type="submit" disabled={busy} className="rounded bg-slate-900 px-3 py-1 text-sm text-white">
          {busy ? COPY.saving : COPY.setBand}
        </button>
        {band ? (
          <button
            type="button"
            disabled={busy}
            className="rounded border border-slate-300 px-3 py-1 text-sm"
            onClick={() => onClear(cell)}
          >
            {COPY.clearBand}
          </button>
        ) : null}
        {band ? (
          <button type="button" className="text-sm text-blue-700 underline" onClick={() => onOpen(cell)}>
            {COPY.openOutside}
          </button>
        ) : null}
      </form>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}

export function Bands() {
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState<Cell | null>(null);
  const [busyKey, setBusyKey] = useState("");
  const [cellError, setCellError] = useState<CellError | null>(null);
  const load = useBands(attempt);
  const bands = load.phase === "ready" ? load.bands : [];
  const byKey = new Map(bands.map((band) => [bandKey(band.country, band.level), band]));
  const openBand = open ? byKey.get(bandKey(open.country, open.level)) : undefined;
  const outside = useOutside(openBand ? open : null, openBand, attempt);

  async function onSet(cell: Cell, minBase: string, maxBase: string): Promise<void> {
    const key = bandKey(cell.country, cell.level);
    setBusyKey(key);
    setCellError(null);
    try {
      await saveBand(cell.country, cell.level, { minBase, maxBase });
      setOpen(cell);
      setAttempt((value) => value + 1);
    } catch (error: unknown) {
      setCellError({ ...cell, message: messageFrom(error, COPY.bandSaveError) });
    } finally {
      setBusyKey("");
    }
  }

  async function onClear(cell: Cell): Promise<void> {
    const key = bandKey(cell.country, cell.level);
    setBusyKey(key);
    setCellError(null);
    try {
      await deleteBand(cell.country, cell.level);
      setOpen((current) =>
        current && current.country === cell.country && current.level === cell.level ? null : current,
      );
      setAttempt((value) => value + 1);
    } catch (error: unknown) {
      setCellError({ ...cell, message: messageFrom(error, COPY.bandClearError) });
    } finally {
      setBusyKey("");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between px-4 py-3">
        <a className="text-blue-700 underline" href="/">
          {COPY.title}
        </a>
        <h1 className="text-xl font-semibold">{COPY.bandsTitle}</h1>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-4">
        {load.phase === "loading" ? <p>{COPY.bandsLoading}</p> : null}
        {load.phase === "error" ? (
          <p>
            {COPY.bandsLoadError}{" "}
            <button type="button" className="text-blue-700 underline" onClick={() => setAttempt((value) => value + 1)}>
              {COPY.retry}
            </button>
          </p>
        ) : null}
        {load.phase === "ready" ? (
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-2 pr-3">{COPY.countryLabel}</th>
                <th className="py-2 pr-3">{COPY.levelLabel}</th>
                <th className="py-2 pr-3">{COPY.bandsTitle}</th>
                <th className="py-2">{COPY.setBand}</th>
              </tr>
            </thead>
            <tbody>
              {allCells().map((cell) => {
                const band = byKey.get(bandKey(cell.country, cell.level));
                const openHere = openBand?.country === cell.country && openBand.level === cell.level;
                const error =
                  cellError?.country === cell.country && cellError.level === cell.level ? cellError.message : "";
                return (
                  <Fragment key={bandKey(cell.country, cell.level)}>
                    <tr className="border-b border-slate-100 align-top">
                      <td className="py-2 pr-3">{cell.country}</td>
                      <td className="py-2 pr-3">{cell.level}</td>
                      <td className="py-2 pr-3">{bandLabel(band)}</td>
                      <td className="py-2">
                        <BandActions
                          cell={cell}
                          band={band}
                          busy={busyKey === bandKey(cell.country, cell.level)}
                          error={error}
                          onSet={(next, minBase, maxBase) => void onSet(next, minBase, maxBase)}
                          onClear={(next) => void onClear(next)}
                          onOpen={setOpen}
                        />
                      </td>
                    </tr>
                    {openHere ? (
                      <tr className="border-b border-slate-100">
                        <td className="py-2" colSpan={4}>
                          {outside.phase === "loading" ? <p>{COPY.outsideLoading}</p> : null}
                          {outside.phase === "error" ? (
                            <p>
                              {COPY.outsideLoadError}{" "}
                              <button
                                type="button"
                                className="text-blue-700 underline"
                                onClick={() => setAttempt((value) => value + 1)}
                              >
                                {COPY.retry}
                              </button>
                            </p>
                          ) : null}
                          {outside.phase === "ready" && band ? (
                            <OutsideTable rows={outside.rows} currency={band.currency} />
                          ) : null}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        ) : null}
      </main>
    </div>
  );
}
