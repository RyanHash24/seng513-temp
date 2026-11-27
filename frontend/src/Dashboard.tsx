
import { loadTransactions } from "./transactionStorage";



const money = (amount: number) =>
  amount.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
  });

function Dashboard({ userId }: { userId: string }) {
  const transactions = loadTransactions(userId);

  console.log("Dashboard user ID:", userId);
  console.log("Dashboard transaction count:", transactions.length);


  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const expenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = income - expenses;

  const recentTransactions = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  return (
    <div
      style={{
        padding: "36px",
        color: "#FFFFFF",
        minHeight: "100vh",
        backgroundColor: "#071B15",
        boxSizing: "border-box",
      }}
    >
      <h1 style={{ fontSize: "32px", marginBottom: "8px" }}>
        Dashboard
      </h1>

      <p style={{ color: "#9CAFA6", marginBottom: "32px" }}>
        Welcome to FinClear. Here's your financial overview.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "20px",
          marginBottom: "32px",
        }}
      >
        <SummaryCard
          title="Total Income"
          amount={money(income)}
          color="#57D995"
        />

        <SummaryCard
          title="Total Expenses"
          amount={money(expenses)}
          color="#FF8585"
        />

        <SummaryCard
          title="Net Balance"
          amount={money(balance)}
          color="#FFFFFF"
        />
      </div>

      <section
        style={{
          backgroundColor: "#10271F",
          border: "1px solid #254438",
          borderRadius: "14px",
          padding: "24px",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: "24px" }}>
          Recent Transactions
        </h2>

        {recentTransactions.length === 0 ? (
          <p style={{ color: "#9CAFA6" }}>
            No recent transactions.
          </p>
        ) : (
          recentTransactions.map((transaction) => (
            <div
              key={transaction.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "16px",
                padding: "16px 0",
                borderBottom: "1px solid #254438",
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>
                  {transaction.name}
                </div>

                <div
                  style={{
                    color: "#9CAFA6",
                    fontSize: "13px",
                    marginTop: "5px",
                  }}
                >
                  {transaction.category} • {transaction.date}
                </div>
              </div>

              <span
                style={{
                  fontWeight: 600,
                  color:
                    transaction.type === "income"
                      ? "#57D995"
                      : "#FF8585",
                }}
              >
                {transaction.type === "income" ? "+" : "-"}
                {money(transaction.amount)}
              </span>
            </div>
          ))
        )}
      </section>

      <p
        style={{
          color: "#9CAFA6",
          fontSize: "12px",
          marginTop: "20px",
        }}
      >
        Dashboard displays your saved transactions.
      </p>
    </div>
  );
}

function SummaryCard({
  title,
  amount,
  color,
}: {
  title: string;
  amount: string;
  color: string;
}) {
  return (
    <div
      style={{
        backgroundColor: "#10271F",
        border: "1px solid #254438",
        borderRadius: "14px",
        padding: "24px",
      }}
    >
      <p
        style={{
          color: "#9CAFA6",
          marginTop: 0,
          marginBottom: "16px",
        }}
      >
        {title}
      </p>

      <h2
        style={{
          color,
          fontSize: "28px",
          margin: 0,
        }}
      >
        {amount}
      </h2>
    </div>
  );
}

export default Dashboard;
