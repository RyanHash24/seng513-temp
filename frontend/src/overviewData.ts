export type OverviewSnapshot = {
  viewer: {
    firstName: string;
    role: "free" | "trial" | "premium";
    trialEndsAt: string | null;
  };
  asOf: string;
  timeZone: string;
  updatedAt: string | null;
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
    currency: string;
  }[];
};
