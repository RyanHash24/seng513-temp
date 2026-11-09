
import { useState } from "react";
import Transactions from "./Transactions";

type Page = "dashboard" | "transactions";

function App() {
  const [page, setPage] = useState<Page>("transactions");

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
        <h1 style={{ color: "#57D995", marginBottom: "36px" }}>
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
        {page === "dashboard" ? (
          <div style={{ padding: "36px" }}>
            <h1>Dashboard</h1>
            <p>Welcome to FinClear.</p>
            <p>Your financial overview will appear here.</p>
          </div>
        ) : (
          <Transactions />
        )}
      </main>
    </div>
  );
}

function navStyle(active: boolean): React.CSSProperties {
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
