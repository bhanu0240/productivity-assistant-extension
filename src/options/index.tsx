/**
 * Options page entry point - renders OptionsPage component
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { OptionsPage } from "./Options";

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <OptionsPage />
  </React.StrictMode>
);
