import type { ReactNode } from "react";
import { COPY } from "./copy";

export const controlClass =
  "h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/30";

export const readOnlyClass =
  "flex min-h-9 items-center rounded-md border border-slate-200 bg-slate-50 px-2.5";

export const primaryButtonClass =
  "inline-flex h-9 items-center justify-center rounded-md bg-slate-900 px-3 text-sm font-medium text-white disabled:opacity-60";

export const quietButtonClass =
  "inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50";

export const cardClass = "rounded-lg border border-slate-200 bg-white";

export const tableClass = "w-full border-collapse text-left text-sm";

export const thClass = "px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500";

export const thRightClass = `${thClass} text-right whitespace-nowrap`;

export const tdClass = "px-3 py-2 align-middle";

export const tdRightClass = `${tdClass} text-right tabular-nums whitespace-nowrap`;

export const trClass = "border-t border-slate-200 hover:bg-slate-50";

type NavId = "people" | "changes" | "bands";

function navId(): NavId | null {
  const path = window.location.pathname;
  if (path === "/changes") return "changes";
  if (path === "/bands") return "bands";
  if (path === "/") return "people";
  return null;
}

function navClass(active: boolean): string {
  return active
    ? "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-slate-100 px-3 font-medium"
    : "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3 text-slate-600 hover:bg-slate-100";
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <a href={href} className={navClass(active)} aria-current={active ? "page" : undefined}>
      {children}
    </a>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const current = navId();
  return (
    <div className="min-h-screen bg-slate-100 text-sm text-slate-900 antialiased">
      <header className="sticky top-0 z-20 h-14 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <a href="/" className="shrink-0 font-semibold">
            {COPY.title}
          </a>
          <nav className="flex items-center gap-1 overflow-x-auto">
            <NavLink href="/" active={current === "people"}>
              {COPY.title}
            </NavLink>
            <NavLink href="/changes" active={current === "changes"}>
              {COPY.changesTitle}
              <span className="text-xs font-normal text-slate-400">{COPY.navDays}</span>
            </NavLink>
            <NavLink href="/bands" active={current === "bands"}>
              {COPY.bandsNav}
            </NavLink>
            <a href="/people/new" className={`${primaryButtonClass} ml-1 shrink-0`}>
              {COPY.addPersonButton}
            </a>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}

export function Main({ children }: { children: ReactNode }) {
  return <main className="mx-auto max-w-7xl px-4 py-4 sm:px-6">{children}</main>;
}

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="mb-4 text-lg font-semibold">{children}</h1>;
}

export function TableHead({ children }: { children: ReactNode }) {
  return <thead className="bg-slate-50">{children}</thead>;
}

export function Notice({ children }: { children: ReactNode }) {
  return <div className={`${cardClass} px-4 py-4`}>{children}</div>;
}
