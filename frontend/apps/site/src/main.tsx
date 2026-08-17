import React from "react";
import { createRoot } from "react-dom/client";
import "@gojet/tokens/css";
import "./styles.css";

function FoundationPage() {
  return (
    <main className="foundation">
      <p className="eyebrow">GOJET V5 · P01</p>
      <h1>Engineering foundation</h1>
      <p>Website and Auth are being rebuilt from the frozen V5 contracts. Public SSG is intentionally not claimed complete at P01.</p>
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");
createRoot(root).render(<React.StrictMode><FoundationPage /></React.StrictMode>);
