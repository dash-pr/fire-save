import {
  BarChart3,
  CircleDollarSign,
  CreditCard,
  Flag,
  Home,
  LineChart,
  PiggyBank,
  ReceiptText,
  Settings,
  Target,
  UploadCloud,
  WalletCards,
} from "lucide-react";
import type { Account } from "@/domain/types";
import { formatJPY } from "@/lib/format";

const nav = [
  { key: "home", label: "Home", icon: Home },
  { key: "budget", label: "Budget", icon: WalletCards },
  { key: "transactions", label: "Transactions", icon: ReceiptText },
  { key: "debt", label: "Debt Plan", icon: CreditCard },
  { key: "goals", label: "Goals", icon: Target },
  { key: "investments", label: "Investments", icon: LineChart },
  { key: "forecast", label: "FATFire Projection", icon: Flag },
  { key: "reports", label: "Reports", icon: BarChart3 },
  { key: "import", label: "Add Transactions", icon: UploadCloud },
  { key: "settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  accounts,
  netWorthYen,
  activePage,
  onNavigate,
}: {
  accounts: Account[];
  netWorthYen: number;
  activePage: string;
  onNavigate: (page: string) => void;
}) {
  return (
    <aside className="hidden min-h-screen w-64 shrink-0 flex-col bg-[#1C1F3A] p-5 text-white lg:flex">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10">
          <PiggyBank className="h-5 w-5" />
        </div>
        <div>
          <p className="text-lg font-semibold">FATFire Planner</p>
          <p className="text-xs text-white/50">Local MVP · JPY</p>
        </div>
      </div>

      <nav className="mt-8 space-y-1">
        {nav.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigate(item.key)}
              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition ${
                activePage === item.key ? "bg-white text-[#1C1F3A]" : "text-white/75 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-8 rounded-3xl bg-white/8 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/80">
          <WalletCards className="h-4 w-4" /> Accounts
        </div>
        <div className="space-y-3">
          {accounts.map((account) => (
            <div key={account.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-white/70">{account.name}</span>
              <span className="font-medium tabular-nums">{formatJPY(account.balanceYen)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto rounded-3xl bg-white p-4 text-[#1C1F3A]">
        <div className="flex items-center gap-2 text-sm text-[#1C1F3A]/70">
          <CircleDollarSign className="h-4 w-4" /> Net worth
        </div>
        <p className="mt-2 text-xl font-semibold tabular-nums">{formatJPY(netWorthYen)}</p>
      </div>
    </aside>
  );
}
