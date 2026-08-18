import React from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { ToastProvider } from "@gojet/ui/feedback";
import "@gojet/tokens/css";
import "@gojet/ui/css";
import "@gojet/ui/patterns.css";
import "@gojet/ui/overlays.css";
import "@gojet/ui/data.css";
import "@gojet/ui/feedback.css";
import "@gojet/ui/layout.css";
import "@gojet/ui/shells.css";
import "./styles.css";
import { router } from "./router";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");
createRoot(root).render(<React.StrictMode><ToastProvider><RouterProvider router={router} /></ToastProvider></React.StrictMode>);
