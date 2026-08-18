import React from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import "@gojet/tokens/css";
import "@gojet/ui/css";
import "@gojet/ui/patterns.css";
import "@gojet/ui/overlays.css";
import "./styles.css";
import { router } from "./router";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");
createRoot(root).render(<React.StrictMode><RouterProvider router={router} /></React.StrictMode>);
