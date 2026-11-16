
import { useState } from "react";
import type { CSSProperties } from "react";
import Transactions from "./Transactions";
import Dashboard from "./Dashboard";
import SavingsGoals from "./SavingsGoals";
import Budgets from "./Budgets";
import Settings from "./Settings";

type Page =
  | "dashboard"
  | "transactions"
  | "budgets"
  | "savings"
  | "settings";

function App() {
  const [page, setPage] = useState<Page>("dashboard");

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        width: "100%",
        backgroundColor: "#071B15",
      }}
    >
      <aside
        style={{
          width: "240px",
          minWidth: "240px",
          boxSizing: "border-box",
          backgroundColor: "#0B1F18",
          padding: "28px 18px",
          borderRight: "1px solid #254438",
          color: "white",
          minHeight: "100vh",
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

        {page === "budgets" && <Budgets />}

        {page === "savings" && <SavingsGoals />}

        {page === "settings" && <Settings />}
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
