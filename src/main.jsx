import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.css";
import RootApp from "./RootApp"; // 👈 変更

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <RootApp />
  </StrictMode>
);
