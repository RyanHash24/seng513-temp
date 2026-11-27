export const filters = [
  "All accounts",
  "Cash",
  "Credit cards",
  "Investments",
  "Loans",
] as const;

export type Filter = (typeof filters)[number];
export type AccountType = Exclude<Filter, "All accounts">;

export type Account = {
  id: string;
  name: string;
  provider: string;
  lastFour: string;
  type: AccountType;
  status: "Connected" | "Reconnect" | "Sample data";
  balance: number | null;
};

export const accounts: Account[] = [
  {
    id: "chequing",
    name: "Everyday chequing",
    provider: "Bank A",
    lastFour: "4821",
    type: "Cash",
    status: "Connected",
    balance: 2480,
  },
  {
    id: "operating",
    name: "Operating account",
    provider: "Bank B",
    lastFour: "2607",
    type: "Cash",
    status: "Connected",
    balance: 12500,
  },
  {
    id: "savings",
    name: "Business savings",
    provider: "",
    lastFour: "7302",
    type: "Cash",
    status: "Reconnect",
    balance: null,
  },
  {
    id: "rewards",
    name: "Rewards credit card",
    provider: "Bank A",
    lastFour: "9164",
    type: "Credit cards",
    status: "Connected",
    balance: 420,
  },
  {
    id: "cashback",
    name: "Cashback credit card",
    provider: "Bank C",
    lastFour: "1048",
    type: "Credit cards",
    status: "Sample data",
    balance: 1240,
  },
  {
    id: "brokerage",
    name: "Sample brokerage",
    provider: "",
    lastFour: "",
    type: "Investments",
    status: "Sample data",
    balance: 18300,
  },
];
