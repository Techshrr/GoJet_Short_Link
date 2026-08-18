import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import "@gojet/tokens/css";
import "@gojet/ui/css";
import "@gojet/ui/patterns.css";
import "@gojet/ui/overlays.css";
import "@gojet/ui/shells.css";
import "./styles.css";
import { router } from "./router";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false } } });
const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");
createRoot(root).render(<React.StrictMode><QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider></React.StrictMode>);
