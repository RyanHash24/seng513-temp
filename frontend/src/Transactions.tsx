
import { useEffect, useMemo, useState } from "react";
import "./Transactions.css";

type Transaction = {
  id: string;
  name: string;
  category: string;
  amount: number;
  date: string;
  type: "income" | "expense";
};

const starterTransactions: Transaction[] = [
  {
    id: "1",
    name: "Groceries",
    category: "Food",
    amount: 85.5,
    date: "2026-11-05",
    type: "expense",
  },
  {
    id: "2",
    name: "Salary",
    category: "Income",
    amount: 4500,
    date: "2026-11-01",
    type: "income",
  },
  {
    id: "3",
    name: "Netflix",
    category: "Subscriptions",
    amount: 16.99,
    date: "2026-10-30",
    type: "expense",
  },
  {
    id: "4",
    name: "Coffee",
    category: "Food",
    amount: 6.5,
    date: "2026-10-28",
    type: "expense",
  },
];

const STORAGE_KEY = "finclear_transactions";

function loadTransactions(): Transaction[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved !== null) {
      const parsed: unknown = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed as Transaction[];
      }
    }
  } catch (error) {
    console.error("Unable to load transactions:", error);
  }

  return starterTransactions;
}

function Transactions() {
  const [transactions, setTransactions] =
    useState<Transaction[]>(loadTransactions);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("Food");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(
    new Date().toLocaleDateString("en-CA")
  );
  const [type, setType] =
    useState<"income" | "expense">("expense");

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(transactions)
    );
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((transaction) => {
        const matchesSearch =
          transaction.name
            .toLowerCase()
            .includes(search.toLowerCase()) ||
          transaction.category
            .toLowerCase()
            .includes(search.toLowerCase());

        const matchesFilter =
          filter === "all" || transaction.type === filter;

        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, search, filter]);

  const income = transactions
    .filter((transaction) => transaction.type === "income")
    .reduce((total, transaction) => total + transaction.amount, 0);

  const expenses = transactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((total, transaction) => total + transaction.amount, 0);

  const currency = (value: number) =>
    value.toLocaleString("en-CA", {
      style: "currency",
      currency: "CAD",
    });

  function addTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedAmount = Number(amount);

    if (
      !name.trim() ||
      !date ||
      !Number.isFinite(parsedAmount) ||
      parsedAmount <= 0
    ) {
      alert("Please enter valid transaction details.");
      return;
    }

    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      name: name.trim(),
      category,
      amount: parsedAmount,
      date,
      type,
    };

    setTransactions((previous) => [
      newTransaction,
      ...previous,
    ]);

    setName("");
    setAmount("");
    setShowForm(false);
  }

  function deleteTransaction(id: string) {
    if (!window.confirm("Delete this transaction?")) return;

    setTransactions((previous) =>
      previous.filter((transaction) => transaction.id !== id)
    );
  }

  return (
    <div className="transactions-page">
      <div className="transactions-header">
        <div>
          <h1>Transactions</h1>
          <p>Track and manage your financial activity.</p>
        </div>

        <button
          className="primary-button"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? "Cancel" : "+ Add Transaction"}
        </button>
      </div>

      <div className="transaction-summary">
        <div className="transaction-card">
          <span>Total Income</span>
          <h2 className="positive">{currency(income)}</h2>
        </div>

        <div className="transaction-card">
          <span>Total Expenses</span>
          <h2 className="negative">{currency(expenses)}</h2>
        </div>

        <div className="transaction-card">
          <span>Net Balance</span>
          <h2>{currency(income - expenses)}</h2>
        </div>
      </div>

      {showForm && (
        <form
          className="transaction-form"
          onSubmit={addTransaction}
        >
          <h2>Add New Transaction</h2>

          <div className="form-grid">
            <label>
              Transaction Name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Groceries"
                required
              />
            </label>

            <label>
              Amount (CAD)
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                required
              />
            </label>

            <label>
              Category
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option>Food</option>
                <option>Transport</option>
                <option>Shopping</option>
                <option>Subscriptions</option>
                <option>Housing</option>
                <option>Entertainment</option>
                <option>Income</option>
                <option>Other</option>
              </select>
            </label>

            <label>
              Date
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                required
              />
            </label>

            <label>
              Type
              <select
                value={type}
                onChange={(event) =>
                  setType(event.target.value as "income" | "expense")
                }
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </label>
          </div>

          <button type="submit" className="primary-button">
            Save Transaction
          </button>
        </form>
      )}

      <div className="transaction-table-container">
        <div className="transaction-toolbar">
          <h2>All Transactions</h2>

          <div className="transaction-filters">
            <input
              type="search"
              placeholder="Search transactions..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="all">All Transactions</option>
              <option value="income">Income</option>
              <option value="expense">Expenses</option>
            </select>
          </div>
        </div>

        <div className="transaction-table-scroll">
          <table className="transaction-table">
            <thead>
              <tr>
                <th>Transaction</th>
                <th>Category</th>
                <th>Date</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredTransactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td>{transaction.name}</td>
                  <td>{transaction.category}</td>
                  <td>{transaction.date}</td>
                  <td>
                    <span className={`type-badge ${transaction.type}`}>
                      {transaction.type}
                    </span>
                  </td>
                  <td
                    className={
                      transaction.type === "income"
                        ? "positive"
                        : "negative"
                    }
                  >
                    {transaction.type === "income" ? "+" : "-"}
                    {currency(transaction.amount)}
                  </td>
                  <td>
                    <button
                      className="delete-button"
                      onClick={() =>
                        deleteTransaction(transaction.id)
                      }
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredTransactions.length === 0 && (
            <p className="empty-transactions">
              No transactions found.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Transactions;
