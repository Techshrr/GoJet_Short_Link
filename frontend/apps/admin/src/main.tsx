import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@gojet/tokens/css";
import "./styles.css";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false } } });

function AdminFoundation() {
  return <main className="foundation"><span>GoJet Admin · P01</span><h1>管理控制台工程骨架</h1><p>AdminShell、DataTable 与治理交互属于 P03/P04/P17；P01 仅冻结独立构建、Query 边界与共享安全客户端。</p></main>;
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");
createRoot(root).render(<React.StrictMode><QueryClientProvider client={queryClient}><AdminFoundation /></QueryClientProvider></React.StrictMode>);
