import { createRoot } from "react-dom/client";
import "./index.css";
import { COPY } from "./copy";
import { Home } from "./pages/Home";

function Page() {
  const path = window.location.pathname;
  if (path === "/people/new") return <p>{COPY.addPerson}</p>;
  if (path === "/people") {
    const id = new URLSearchParams(window.location.search).get("id") ?? "";
    return <p>{id}</p>;
  }
  return <Home />;
}

createRoot(document.getElementById("root")!).render(<Page />);
