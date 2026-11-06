
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
  {
    title: "Total Savings",
    amount: "$6,800.00",
    description: "Your savings progress",
  },
];

function App() {
  return (
    <div className="min-h-screen bg-[#071B15] text-white md:flex">
      {/* Sidebar */}
      <aside className="w-full border-b border-[#204034] bg-[#0B1F18] p-6 md:min-h-screen md:w-64 md:border-b-0 md:border-r">
        <h1 className="text-3xl font-bold text-[#57D995]">
          FinClear
        </h1>

        <p className="mt-2 text-sm text-[#9CAFA6]">
          Take control of your finances.
        </p>

        <nav className="mt-10 space-y-2" aria-label="Main navigation">
          {menuItems.map((item) => (
            <div
              key={item}
              className={`rounded-lg p-3 ${
                item === "Dashboard"
                  ? "bg-[#57D995] font-semibold text-[#071B15]"
                  : "text-[#9CAFA6]"
              }`}
            >
              {item}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Dashboard */}
      <main className="min-w-0 flex-1 p-5 md:p-8">
        <header>
          <h2 className="text-3xl font-semibold">
            Dashboard
          </h2>

          <p className="mt-2 text-[#9CAFA6]">
            Welcome back! Here's your financial overview.
          </p>
        </header>

        {/* Financial Cards */}
        <section
          className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4"
          aria-label="Financial summary"
        >
          {summaryCards.map((card) => (
            <div
              key={card.title}
              className="rounded-xl border border-[#204034] bg-[#10271F] p-6"
            >
              <h3 className="text-sm text-[#9CAFA6]">
                {card.title}
              </h3>

              <p className="mt-3 text-3xl font-bold">
                {card.amount}
              </p>

              <p className="mt-2 text-sm text-[#57D995]">
                {card.description}
              </p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}

export default App;
