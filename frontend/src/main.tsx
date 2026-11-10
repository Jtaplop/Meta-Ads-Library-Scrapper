import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "sonner";
import App from "./App";
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Failed to find root element");
}

ReactDOM.createRoot(rootElement).render(
  <StrictMode>
    <App />
    <Toaster richColors position="top-right" theme="dark" />
  </StrictMode>
);
