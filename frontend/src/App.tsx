
const menuItems = [
  "Dashboard",
  "Transactions",
  "Budgets",
  "Savings Goals",
  "Reports",
  "Settings",
];

const summaryCards = [
  {
    title: "Total Balance",
    amount: "$12,450.00",
    description: "Your current account balance",
  },
  {
    title: "Monthly Income",
    amount: "$4,500.00",
    description: "Income this month",
  },
  {
    title: "Monthly Expenses",
    amount: "$2,150.00",
    description: "Expenses this month",
  },
];

const transactions = [
  {
    name: "Groceries",
    date: "Nov 5, 2026",
    amount: "-$85.50",
  },
  {
    name: "Salary",
    date: "Nov 1, 2026",
    amount: "+$4,500.00",
  },
  {
    name: "Netflix",
    date: "Oct 30, 2026",
    amount: "-$16.99",
  },
  {
    name: "Coffee",
    date: "Oct 28, 2026",
    amount: "-$6.50",
  },
];

function App() {
  return (
    <div className="flex min-h-screen bg-[#071B15] text-white">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-[#0B1F18] p-6">
        <h1 className="text-3xl font-bold text-[#57D995]">
          FinClear
        </h1>

        <p className="mt-2 text-sm text-[#9CAFA6]">
          Take control of your finances.
        </p>

        <nav
          className="mt-10 space-y-3"
          aria-label="Main navigation"
        >
          {menuItems.map((item) => (
            <div
              key={item}
              className={`rounded-lg p-3 ${
                item === "Dashboard"
                  ? "bg-[#10271F] text-[#57D995]"
                  : "text-[#9CAFA6]"
              }`}
            >
              {item}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Dashboard */}
      <main className="min-w-0 flex-1 p-8">
        {/* Dashboard Header */}
        <header>
          <h2 className="text-2xl font-semibold">
            Dashboard
          </h2>

          <p className="mt-2 text-[#9CAFA6]">
            Welcome back! Here's your financial overview.
          </p>
        </header>

        {/* Financial Summary Cards */}
        <section className="mt-8 grid gap-6 md:grid-cols-3">
          {summaryCards.map((card) => (
            <div
              key={card.title}
              className="rounded-xl bg-[#10271F] p-6"
            >
              <h3 className="text-sm text-[#9CAFA6]">
                {card.title}
              </h3>

              <p className="mt-3 text-3xl font-bold text-white">
                {card.amount}
              </p>

              <p className="mt-2 text-sm text-[#57D995]">
                {card.description}
              </p>
            </div>
          ))}
        </section>

        {/* Recent Transactions */}
        <section className="mt-8">
          <div className="rounded-xl bg-[#10271F] p-6">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                Recent Transactions
              </h3>

              <span className="text-sm text-[#57D995]">
                View All
              </span>
            </div>

            <div className="space-y-4">
              {transactions.map((transaction) => (
                <div
                  key={transaction.name}
                  className="flex items-center justify-between border-b border-[#244337] pb-3"
                >
                  <div>
                    <p className="font-medium text-white">
                      {transaction.name}
                    </p>

                    <p className="text-sm text-[#9CAFA6]">
                      {transaction.date}
                    </p>
                  </div>

                  <p
                    className={`font-semibold ${
                      transaction.amount.startsWith("+")
                        ? "text-[#57D995]"
                        : "text-white"
                    }`}
                  >
                    {transaction.amount}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
