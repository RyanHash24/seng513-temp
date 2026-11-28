
import { useState } from "react";
import "./SavingsGoals.css";

type Goal = {
  id: number;
  name: string;
  target: number;
  saved: number;
  deadline: string;
};

export default function SavingsGoals() {
  const [goals, setGoals] = useState<Goal[]>([
    {
      id: 1,
      name: "Emergency Fund",
      target: 5000,
      saved: 2500,
      deadline: "2027-06-01",
    },
    {
      id: 2,
      name: "New Laptop",
      target: 2000,
      saved: 800,
      deadline: "2027-03-01",
    },
  ]);

  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");

  function addGoal(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!name.trim() || Number(target) <= 0 || !deadline) {
      return;
    }

    setGoals((current) => [
      ...current,
      {
        id: Date.now(),
        name: name.trim(),
        target: Number(target),
        saved: 0,
        deadline,
      },
    ]);

    setName("");
    setTarget("");
    setDeadline("");
  }

  function addSavings(id: number) {
    const input = prompt("Enter amount to save:");
    if (input === null || input.trim() === "") return;

    const amount = Number(input);

    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Please enter a valid positive amount.");
      return;
    }

    setGoals((current) =>
      current.map((goal) =>
        goal.id === id
          ? { ...goal, saved: goal.saved + amount }
          : goal
      )
    );
  }

  function deleteGoal(id: number) {
    if (!confirm("Are you sure you want to delete this goal?")) {
      return;
    }

    setGoals((current) =>
      current.filter((goal) => goal.id !== id)
    );
  }

  const money = (amount: number) =>
    amount.toLocaleString("en-CA", {
      style: "currency",
      currency: "CAD",
    });

  return (
    <div className="savings-page">
      <h1>Savings Goals</h1>
      <p className="savings-subtitle">
        Set financial goals and track your progress.
      </p>

      <div className="savings-summary">
        <div className="savings-card">
          <span>Total Goals</span>
          <h2>{goals.length}</h2>
        </div>

        <div className="savings-card">
          <span>Total Saved</span>
          <h2 className="green">
            {money(goals.reduce((sum, goal) => sum + goal.saved, 0))}
          </h2>
        </div>

        <div className="savings-card">
          <span>Total Target</span>
          <h2>
            {money(goals.reduce((sum, goal) => sum + goal.target, 0))}
          </h2>
        </div>
      </div>

      <section className="savings-section">
        <h2>Create New Goal</h2>

        <form className="goal-form" onSubmit={addGoal}>
          <label><span>Goal name</span>
          <input
            placeholder="Goal name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          </label>

          <label><span>Target amount (CAD)</span>
          <input
            type="number"
            placeholder="Target amount"
            min="0.01"
            step="0.01"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            required
          />
          </label>

          <label><span>Deadline</span>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            required
          />
          </label>

          <button type="submit" className="goal-primary">
            + Add Goal
          </button>
        </form>
      </section>

      <section className="savings-section">
        <h2>My Savings Goals</h2>

        {goals.length === 0 && <p>No savings goals yet.</p>}

        <div className="goals-grid">
          {goals.map((goal) => {
            const progress = Math.min(
              (goal.saved / goal.target) * 100,
              100
            );

            return (
              <div className="goal-card" key={goal.id}>
                <div className="goal-header">
                  <h3>{goal.name}</h3>
                  <button
                    className="goal-delete"
                    onClick={() => deleteGoal(goal.id)}
                  >
                    Delete
                  </button>
                </div>

                <p>
                  {money(goal.saved)} of {money(goal.target)}
                </p>

                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="goal-details">
                  <span>{progress.toFixed(0)}% completed</span>
                  <span>Deadline: {goal.deadline}</span>
                </div>

                <button
                  className="goal-primary"
                  onClick={() => addSavings(goal.id)}
                >
                  + Add Savings
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
