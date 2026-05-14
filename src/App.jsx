import { useState } from "react";
import FunilVendas from "./pages/FunilVendas";
import Metas from "./pages/Metas";
import Mural from "./pages/Mural";
import Aniversariantes from "./pages/Aniversariantes";
import Eventos from "./pages/Eventos";
import Marketing from "./pages/Marketing";

const TABS = [
  { id: "funil", label: "Funil de Vendas", Component: FunilVendas },
  { id: "metas", label: "Metas", Component: Metas },
  { id: "mural", label: "Mural de Avisos", Component: Mural },
  { id: "aniversariantes", label: "Aniversariantes", Component: Aniversariantes },
  { id: "eventos", label: "Eventos", Component: Eventos },
  { id: "marketing", label: "Marketing", Component: Marketing },
];

export default function App() {
  const [tabId, setTabId] = useState("funil");
  const { Component } = TABS.find((t) => t.id === tabId);

  return (
    <div style={{ minHeight: "100vh", background: "#0b1220" }}>
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "0 24px",
          background: "#111a2e",
          borderBottom: "1px solid #1c2d42",
          overflowX: "auto",
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: "#1a8fff",
            padding: "14px 16px 14px 0",
            whiteSpace: "nowrap",
          }}
        >
          All Business
        </span>
        {TABS.map((t) => {
          const active = t.id === tabId;
          return (
            <button
              key={t.id}
              onClick={() => setTabId(t.id)}
              style={{
                fontSize: 12,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 0.6,
                color: active ? "#1a8fff" : "#7a90aa",
                background: "transparent",
                border: "none",
                borderBottom: `2px solid ${active ? "#1a8fff" : "transparent"}`,
                padding: "14px 16px",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </nav>
      <Component />
    </div>
  );
}
