import { useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  ChevronDown,
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
import type { Account, Investment } from "@/domain/types";
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
  investments,
  netWorthYen,
  activePage,
  onNavigate,
  onAddAccount,
  onEditAccount,
  onSelectAccount,
}: {
  accounts: Account[];
  investments: Investment[];
  netWorthYen: number;
  activePage: string;
  onNavigate: (page: string) => void;
  onAddAccount: (account: Account) => void;
  onEditAccount: (id: string, changes: Partial<Account>) => void;
  onSelectAccount: (accountId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [addType, setAddType] = useState<"credit" | "savings" | null>(null);
  const [draft, setDraft] = useState({ name: "", balanceYen: 0, creditLimit: 0 });
  const visibleAccounts = accounts.filter((account) => !account.isArchived);
  const creditAccounts = visibleAccounts.filter((account) => account.type === "credit");
  const savingsAccounts = visibleAccounts.filter((account) => account.type !== "credit");
  const investedTotal = investments.reduce((total, investment) => total + investment.currentBalanceYen, 0);
  const saveAccount = () => {
    if (!addType || !draft.name.trim()) return;
    onAddAccount({
      id: `acct-${Math.random().toString(36).slice(2, 9)}`,
      name: draft.name.trim(),
      type: addType === "credit" ? "credit" : "savings",
      balanceYen: addType === "credit" ? -Math.abs(draft.balanceYen) : draft.balanceYen,
      creditLimit: addType === "credit" ? draft.creditLimit : undefined,
    });
    setDraft({ name: "", balanceYen: 0, creditLimit: 0 });
    setAddType(null);
  };

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

      <div className="mt-8 space-y-3 rounded-3xl bg-white/8 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white/80"><WalletCards className="h-4 w-4" /> Accounts</div>
        <SidebarAccountSection title="Credit Cards" total={creditAccounts.reduce((total, account) => total + account.balanceYen, 0)} collapsed={collapsed.credit ?? false} onToggle={() => setCollapsed((previous) => ({ ...previous, credit: !previous.credit }))} onAdd={() => setAddType("credit")} tone="red">
          {creditAccounts.map((account) => <SidebarAccountRow key={account.id} account={account} onClick={() => onSelectAccount(account.id)} onEdit={(changes) => onEditAccount(account.id, changes)} />)}
        </SidebarAccountSection>
        <SidebarAccountSection title="Savings Accounts" total={savingsAccounts.reduce((total, account) => total + account.balanceYen, 0)} collapsed={collapsed.savings ?? false} onToggle={() => setCollapsed((previous) => ({ ...previous, savings: !previous.savings }))} onAdd={() => setAddType("savings")}>
          {savingsAccounts.map((account) => <SidebarAccountRow key={account.id} account={account} onClick={() => onSelectAccount(account.id)} onEdit={(changes) => onEditAccount(account.id, changes)} />)}
        </SidebarAccountSection>
        <SidebarAccountSection title="Investments" total={investedTotal} collapsed={collapsed.investments ?? false} onToggle={() => setCollapsed((previous) => ({ ...previous, investments: !previous.investments }))} onAdd={() => onNavigate("investments")}>
          <button type="button" onClick={() => onNavigate("investments")} className="w-full rounded-2xl bg-white/8 px-3 py-2 text-left text-sm text-white/70 hover:bg-white/12">Manage investment accounts</button>
        </SidebarAccountSection>
      </div>

      <div className="mt-auto rounded-3xl bg-white p-4 text-[#1C1F3A]">
        <div className="flex items-center gap-2 text-sm text-[#1C1F3A]/70">
          <CircleDollarSign className="h-4 w-4" /> Net worth
        </div>
        <p className="mt-2 text-xl font-semibold tabular-nums">{formatJPY(netWorthYen)}</p>
      </div>
      {addType && <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/40 p-6 text-slate-950"><div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><h3 className="text-xl font-semibold">Add {addType === "credit" ? "Credit Card" : "Savings Account"}</h3><div className="mt-4 space-y-3"><SidebarModalInput label="Account name" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} /><SidebarModalInput label={addType === "credit" ? "Current balance owed" : "Starting balance"} type="number" value={String(draft.balanceYen)} onChange={(value) => setDraft({ ...draft, balanceYen: Number(value) || 0 })} />{addType === "credit" && <SidebarModalInput label="Credit limit" type="number" value={String(draft.creditLimit)} onChange={(value) => setDraft({ ...draft, creditLimit: Number(value) || 0 })} />}<div className="flex gap-3"><button type="button" onClick={() => setAddType(null)} className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">Cancel</button><button type="button" onClick={saveAccount} className="flex-1 rounded-2xl bg-[#1C1F3A] px-4 py-3 text-sm font-semibold text-white">Add</button></div></div></div></div>}
    </aside>
  );
}

function SidebarAccountSection({ title, total, collapsed, onToggle, onAdd, children, tone = "green" }: { title: string; total: number; collapsed: boolean; onToggle: () => void; onAdd: () => void; children: ReactNode; tone?: "green" | "red" }) {
  return <section className="rounded-2xl bg-white/6 p-3"><div className="flex items-center justify-between gap-2"><button type="button" onClick={onToggle} className="flex min-w-0 items-center gap-2 text-left text-sm font-semibold text-white/85"><ChevronDown className={`h-4 w-4 transition ${collapsed ? "-rotate-90" : ""}`} /><span className="truncate">{title}</span></button><div className="flex items-center gap-2"><span className={`text-xs font-semibold tabular-nums ${tone === "red" && total < 0 ? "text-red-300" : "text-emerald-200"}`}>{formatJPY(total)}</span><button type="button" onClick={onAdd} className="rounded-full bg-white/10 px-2 py-1 text-xs font-semibold text-white/80 hover:bg-white/20">+ Add</button></div></div><AnimatePresence initial={false}>{!collapsed && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: "easeOut" }} className="mt-3 space-y-2 overflow-hidden">{children}</motion.div>}</AnimatePresence></section>;
}

function SidebarAccountRow({ account, onClick, onEdit }: { account: Account; onClick: () => void; onEdit: (changes: Partial<Account>) => void }) {
  const editAccount = () => {
    const name = window.prompt("Account name", account.name);
    if (!name) return;
    onEdit({ name });
  };
  const archiveAccount = () => onEdit({ isArchived: true } as Partial<Account>);
  return <button type="button" onClick={onClick} onContextMenu={(event) => { event.preventDefault(); if (window.confirm("Edit this account? Choose Cancel to archive instead.")) editAccount(); else archiveAccount(); }} className="flex w-full items-center justify-between gap-3 rounded-2xl px-2 py-2 text-left text-sm hover:bg-white/8"><span className="truncate text-white/70">{account.name}</span><span className={`font-medium tabular-nums ${account.balanceYen < 0 ? "text-red-300" : "text-white"}`}>{formatJPY(account.balanceYen)}</span></button>;
}

function SidebarModalInput({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="block"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-[#4A7CFF]" /></label>;
}
