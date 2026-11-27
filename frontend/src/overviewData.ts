export type OverviewSnapshot = {
  viewer: {
    firstName: string;
    role: "free" | "trial" | "premium";
    trialEndsAt: string | null;
  };
  asOf: string;
  timeZone: string;
  updatedAt: string | null;
  isPreview: boolean;
  linkedAccountCount: number;
  period: {
    start: string;
    end: string;
    allocated: number;
    spent: number;
  };
  spending: { category: string; amount: number }[];
  recentTransactions: {
    id: string;
    merchant: string;
    category: string;
    account: string;
    date: string;
    amount: number;
    direction: "income" | "expense";
    icon: "groceries" | "transport";
  }[];
};

// Design-preview fixture, not imported bank records. The authenticated overview
// response can supply this same snapshot without changing the screen layout.
export const overviewPreview: OverviewSnapshot = {
  viewer: { firstName: "Morgan", role: "trial", trialEndsAt: "2026-12-09" },
  asOf: "2026-11-25T17:00:00Z",
  timeZone: "America/Edmonton",
  updatedAt: "2026-11-25T16:58:00Z",
  isPreview: true,
  linkedAccountCount: 1,
  period: { start: "2026-11-20", end: "2026-12-19", allocated: 3600, spent: 2040 },
  spending: [
    { category: "Home & bills", amount: 1200 },
    { category: "Food & drink", amount: 630 },
    { category: "Other spending", amount: 210 },
  ],
  recentTransactions: [
    { id: "preview-market", merchant: "Fresh Market", category: "Groceries", account: "Chequing •4821", date: "2026-11-25", amount: 45, direction: "expense", icon: "groceries" },
    { id: "preview-transit", merchant: "Transit fare", category: "Transit", account: "Credit •6138", date: "2026-11-25", amount: 15, direction: "expense", icon: "transport" },
    { id: "preview-fuel", merchant: "Fuel station", category: "Fuel", account: "Chequing •4821", date: "2026-11-25", amount: 30, direction: "expense", icon: "transport" },
  ],
};
