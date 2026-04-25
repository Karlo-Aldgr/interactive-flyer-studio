import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { installGlobalErrorLogging, log } from "./lib/logger";

installGlobalErrorLogging();
log.info("[boot]", "Mounting <App />");

const rootEl = document.getElementById("root");
if (!rootEl) {
  log.error("[boot]", "#root element not found in index.html");
  document.body.innerHTML =
    '<pre style="padding:24px;font-family:monospace;color:#dc2626">FATAL: #root element missing in index.html</pre>';
} else {
  createRoot(rootEl).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
  );
}
