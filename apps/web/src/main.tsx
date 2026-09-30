import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { onAppLinkClick } from "./navigate";
import { Bands } from "./pages/Bands";
import { Changes } from "./pages/Changes";
import { Home } from "./pages/Home";
import { Person } from "./pages/Person";

function Page({ location }: { location: string }) {
  const url = new URL(location, "http://app");
  if (url.pathname === "/people/new") return <Person employeeId={null} />;
  if (url.pathname === "/people") return <Person employeeId={url.searchParams.get("id") ?? ""} />;
  if (url.pathname === "/changes") return <Changes />;
  if (url.pathname === "/bands") return <Bands />;
  return <Home />;
}

function App() {
  const [location, setLocation] = useState(
    () => `${window.location.pathname}${window.location.search}`,
  );

  useEffect(() => {
    const onPop = () => setLocation(`${window.location.pathname}${window.location.search}`);
    window.addEventListener("popstate", onPop);
    document.addEventListener("click", onAppLinkClick);
    return () => {
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("click", onAppLinkClick);
    };
  }, []);

  return <Page location={location} />;
}

createRoot(document.getElementById("root")!).render(<App />);
