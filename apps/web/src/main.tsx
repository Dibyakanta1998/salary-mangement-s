import { createRoot } from "react-dom/client";
import "./index.css";
import { Bands } from "./pages/Bands";
import { Changes } from "./pages/Changes";
import { Home } from "./pages/Home";
import { Person } from "./pages/Person";

function Page() {
  const path = window.location.pathname;
  if (path === "/people/new") return <Person employeeId={null} />;
  if (path === "/people") {
    const id = new URLSearchParams(window.location.search).get("id") ?? "";
    return <Person employeeId={id} />;
  }
  if (path === "/changes") return <Changes />;
  if (path === "/bands") return <Bands />;
  return <Home />;
}

createRoot(document.getElementById("root")!).render(<Page />);
