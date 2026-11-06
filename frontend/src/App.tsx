
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

const budgets = [
  {
    name: "Groceries",
    spent: 350,
    limit: 500,
  },
  {
    name: "Entertainment",
    spent: 120,
    limit: 200,
  },
  {
    name: "Transportation",
    spent: 180,
    limit: 300,
  },
];

const savingsGoals = [
  {
    name: "Emergency Fund",
    saved: 3000,
    target: 5000,
  },
  {
    name: "Vacation",
    saved: 1200,
    target: 3000,
  },
  {
    name: "New Laptop",
    saved: 800,
    target: 2000,
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
              <h3 className="text-lg font-semibold">
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
                    <p className="font-medium">
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

        {/* Budgets and Savings Goals */}
        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* Monthly Budgets */}
          <div className="rounded-xl bg-[#10271F] p-6">
            <h3 className="mb-6 text-lg font-semibold">
              Monthly Budgets
            </h3>

            <div className="space-y-6">
              {budgets.map((budget) => {
                const percentage = Math.min(
                  (budget.spent / budget.limit) * 100,
                  100
                );

                return (
                  <div key={budget.name}>
                    <div className="mb-2 flex justify-between text-sm">
                      <span>{budget.name}</span>

                      <span className="text-[#9CAFA6]">
                        ${budget.spent} / ${budget.limit}
                      </span>
                    </div>

                    <div
                      className="h-3 overflow-hidden rounded-full bg-[#244337]"
                      role="progressbar"
                      aria-label={`${budget.name} budget used`}
                      aria-valuenow={percentage}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="h-full rounded-full bg-[#57D995]"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>

                    <p className="mt-1 text-xs text-[#9CAFA6]">
                      {percentage.toFixed(0)}% used
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Savings Goals */}
          <div className="rounded-xl bg-[#10271F] p-6">
            <h3 className="mb-6 text-lg font-semibold">
              Savings Goals
            </h3>

            <div className="space-y-6">
              {savingsGoals.map((goal) => {
                const percentage = Math.min(
                  (goal.saved / goal.target) * 100,
                  100
                );

                return (
                  <div key={goal.name}>
                    <div className="mb-2 flex justify-between text-sm">
                      <span>{goal.name}</span>

                      <span className="text-[#9CAFA6]">
                        ${goal.saved} / ${goal.target}
                      </span>
                    </div>

                    <div
                      className="h-3 overflow-hidden rounded-full bg-[#244337]"
                      role="progressbar"
                      aria-label={`${goal.name} savings progress`}
                      aria-valuenow={percentage}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="h-full rounded-full bg-[#57D995]"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>

                    <p className="mt-1 text-xs text-[#9CAFA6]">
                      {percentage.toFixed(0)}% completed
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
