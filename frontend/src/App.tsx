
function App() {
  const menuItems = [
    "Dashboard",
    "Transactions",
    "Budgets",
    "Savings Goals",
    "Settings",
  ];

  return (
    <div className="min-h-screen bg-[#071B15] text-white md:flex">
      <aside className="bg-[#0B1F18] p-6 md:min-h-screen md:w-64">
        <h1 className="text-3xl font-bold text-[#57D995]">
          FinClear
        </h1>

        <nav className="mt-10 space-y-3" aria-label="Main navigation">
          {menuItems.map((item) => (
            <div
              key={item}
              className="rounded-lg p-3 text-[#9CAFA6]"
            >
              {item}
            </div>
          ))}
        </nav>
      </aside>

      <main className="flex-1 p-8">
        <header>
          <h2 className="text-2xl font-semibold">
            Dashboard
          </h2>
          <p className="mt-2 text-[#9CAFA6]">
            Welcome back! Here's your financial overview.
          </p>
        </header>
      </main>
    </div>
  );
}

export default App;
