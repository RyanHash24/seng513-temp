export type Transaction = {
  id: string;
  name: string;
  category: string;
  amount: number;
  date: string;
  type: "income" | "expense";
};

export const storageKey = (userId: string) =>
  `finclear_transactions_${userId}`;

export function loadTransactions(userId: string): Transaction[] {
  try {
    const saved = localStorage.getItem(storageKey(userId));

    if (saved !== null) {
      const parsed: unknown = JSON.parse(saved);

      if (Array.isArray(parsed)) {
        return parsed as Transaction[];
      }
    }
  } catch (error) {
    console.error("Unable to load transactions:", error);
  }

  return [];
}