
import { useState } from "react";
import type { CSSProperties } from "react";
import Transactions from "./Transactions";
import Dashboard from "./Dashboard";

type Page =
  | "dashboard"
  | "transactions"
  | "budgets"
  | "savings"
  | "settings";

function App() {
  const [page, setPage] = useState<Page>("dashboard");

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        style={{
          width: "240px",
          minWidth: "240px",
          backgroundColor: "#0B1F18",
          padding: "28px 18px",
          borderRight: "1px solid #254438",
          color: "white",
        }}
      >
        <h1
          style={{
            color: "#57D995",
            marginBottom: "36px",
          }}
        >
          FinClear
        </h1>

        <nav style={{ display: "grid", gap: "12px" }}>
          <button
            onClick={() => setPage("dashboard")}
            style={navStyle(page === "dashboard")}
          >
            Dashboard
          </button>

          <button
            onClick={() => setPage("transactions")}
            style={navStyle(page === "transactions")}
          >
            Transactions
          </button>

          <button
            onClick={() => setPage("budgets")}
            style={navStyle(page === "budgets")}
          >
            Budgets
          </button>

          <button
            onClick={() => setPage("savings")}
            style={navStyle(page === "savings")}
          >
            Savings Goals
          </button>

          <button
            onClick={() => setPage("settings")}
            style={navStyle(page === "settings")}
          >
            Settings
          </button>
        </nav>
      </aside>

      <main
        style={{
          flex: 1,
          minWidth: 0,
          backgroundColor: "#071B15",
          color: "white",
        }}
      >
        {page === "dashboard" && <Dashboard />}

        {page === "transactions" && <Transactions />}

        {page === "budgets" && (
          <div style={{ padding: "36px" }}>
            <h1>Budgets</h1>
            <p>Manage your monthly budgets here.</p>
          </div>
        )}

        {page === "savings" && (
          <div style={{ padding: "36px" }}>
            <h1>Savings Goals</h1>
            <p>Track your savings goals here.</p>
          </div>
        )}

        {page === "settings" && (
          <div style={{ padding: "36px" }}>
            <h1>Settings</h1>
            <p>Manage your FinClear preferences here.</p>
          </div>
        )}
      </main>
    </div>
  );
}

function navStyle(active: boolean): CSSProperties {
  return {
    padding: "14px 16px",
    textAlign: "left",
    border: "none",
    borderRadius: "8px",
    backgroundColor: active ? "#174734" : "transparent",
    color: active ? "#57D995" : "#FFFFFF",
    cursor: "pointer",
    fontSize: "15px",
    fontWeight: active ? 700 : 400,
  };
}

export default App;
