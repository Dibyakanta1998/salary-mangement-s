export function navigate(href: string): void {
  const url = new URL(href, window.location.href);
  const next = `${url.pathname}${url.search}`;
  const current = `${window.location.pathname}${window.location.search}`;
  if (next === current) return;
  window.history.pushState(null, "", next);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function onAppLinkClick(event: MouseEvent): void {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const anchor = (event.target as Element | null)?.closest("a");
  if (!(anchor instanceof HTMLAnchorElement)) return;
  if (anchor.target && anchor.target !== "_self") return;
  if (anchor.hasAttribute("download")) return;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return;
  event.preventDefault();
  navigate(`${url.pathname}${url.search}`);
}
