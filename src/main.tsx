import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppProviders } from "./app/AppProviders";
import { AppRouter } from "./app/AppRouter";
import "leaflet/dist/leaflet.css";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("NOVA application root was not found.");

createRoot(root).render(
  <StrictMode>
    <AppProviders><AppRouter /></AppProviders>
  </StrictMode>,
);
