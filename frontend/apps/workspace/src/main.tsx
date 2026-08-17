import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@gojet/tokens/css";
import "./styles.css";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } } });

function WorkspaceFoundation() {
  return <main className="foundation"><span>GoJet Workspace · P01</span><h1>工作台工程骨架</h1><p>正式 CustomerShell 与 Links Vertical Slice 将分别在 P04 / P05 实现；此处只建立独立 bundle、Query 边界与共享安全客户端。</p></main>;
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");
createRoot(root).render(<React.StrictMode><QueryClientProvider client={queryClient}><WorkspaceFoundation /></QueryClientProvider></React.StrictMode>);
