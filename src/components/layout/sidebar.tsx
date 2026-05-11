import { useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  ChevronDown,
  CreditCard,
  Flag,
  Home,
  LineChart,
  PiggyBank,
  Plus,
  ReceiptText,
  Settings,
  Target,
  UploadCloud,
  WalletCards,
} from "lucide-react";
import type { Account, Investment } from "@/domain/types";
import { formatJPY } from "@/lib/format";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
    <TooltipProvider delayDuration={250}>
      <aside className="hidden min-h-screen w-[260px] shrink-0 flex-col bg-[#1C1F3A] px-4 py-5 text-white lg:flex">
        <div className="flex items-center gap-2.5 px-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/10">
            <PiggyBank className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium leading-tight">FATFire Planner</p>
            <p className="text-[11px] text-[#8B90B0]">Local MVP · JPY</p>
          </div>
        </div>

        <nav className="mt-6 space-y-0.5">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = activePage === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onNavigate(item.key)}
                className={`flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-[13px] transition ${
                  active
                    ? "bg-[#4A7CFF]/15 text-[#A9BEFF]"
                    : "text-[#8B90B0] hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2 : 1.8} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-8 space-y-5">
          <SidebarAccountSection
            title="Credit Cards"
            total={creditAccounts.reduce((total, account) => total + account.balanceYen, 0)}
            collapsed={collapsed.credit ?? false}
            onToggle={() => setCollapsed((previous) => ({ ...previous, credit: !previous.credit }))}
            onAdd={() => setAddType("credit")}
            tone="red"
          >
            {creditAccounts.length === 0 ? (
              <EmptySectionHint>No cards yet</EmptySectionHint>
            ) : (
              creditAccounts.map((account) => (
                <SidebarAccountRow
                  key={account.id}
                  account={account}
                  onClick={() => onSelectAccount(account.id)}
                  onEdit={(changes) => onEditAccount(account.id, changes)}
                />
              ))
            )}
          </SidebarAccountSection>
          <SidebarAccountSection
            title="Savings Accounts"
            total={savingsAccounts.reduce((total, account) => total + account.balanceYen, 0)}
            collapsed={collapsed.savings ?? false}
            onToggle={() => setCollapsed((previous) => ({ ...previous, savings: !previous.savings }))}
            onAdd={() => setAddType("savings")}
          >
            {savingsAccounts.length === 0 ? (
              <EmptySectionHint>No accounts yet</EmptySectionHint>
            ) : (
              savingsAccounts.map((account) => (
                <SidebarAccountRow
                  key={account.id}
                  account={account}
                  onClick={() => onSelectAccount(account.id)}
                  onEdit={(changes) => onEditAccount(account.id, changes)}
                />
              ))
            )}
          </SidebarAccountSection>
          <SidebarAccountSection
            title="Investments"
            total={investedTotal}
            collapsed={collapsed.investments ?? false}
            onToggle={() => setCollapsed((previous) => ({ ...previous, investments: !previous.investments }))}
            onAdd={() => onNavigate("investments")}
          >
            <button
              type="button"
              onClick={() => onNavigate("investments")}
              className="flex h-8 w-full items-center rounded-md px-2 text-left text-[12px] text-[#8B90B0] hover:bg-white/[0.06] hover:text-white"
            >
              Manage investment accounts →
            </button>
          </SidebarAccountSection>
        </div>

        <div className="mt-auto pt-6">
          <div className="flex items-center justify-between px-2 pb-3">
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#8B90B0]">
              Net worth
            </span>
            <span className="text-sm font-medium tabular-nums text-white">
              {formatJPY(netWorthYen)}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-white/[0.06] px-2 pt-3 text-[11px] text-[#8B90B0]">
            <button
              type="button"
              onClick={() => onNavigate("settings")}
              className="inline-flex items-center gap-1.5 hover:text-white"
            >
              <Settings className="h-3.5 w-3.5" />
              Settings
            </button>
            <span className="tabular-nums">v0.1.0</span>
          </div>
        </div>

        {addType && (
          <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/40 p-6 text-slate-950">
            <div className="w-full max-w-[480px] rounded-2xl bg-white p-6 shadow-xl">
              <h3 className="text-base font-medium">
                Add {addType === "credit" ? "Credit Card" : "Savings Account"}
              </h3>
              <div className="mt-4 space-y-3">
                <SidebarModalInput
                  label="Account name"
                  value={draft.name}
                  onChange={(value) => setDraft({ ...draft, name: value })}
                />
                <SidebarModalInput
                  label={addType === "credit" ? "Current balance owed" : "Starting balance"}
                  type="number"
                  value={String(draft.balanceYen)}
                  onChange={(value) => setDraft({ ...draft, balanceYen: Number(value) || 0 })}
                />
                {addType === "credit" && (
                  <SidebarModalInput
                    label="Credit limit"
                    type="number"
                    value={String(draft.creditLimit)}
                    onChange={(value) => setDraft({ ...draft, creditLimit: Number(value) || 0 })}
                  />
                )}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setAddType(null)}
                    className="flex-1 rounded-lg bg-[#F5F4F0] px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-[#EEEDE9]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveAccount}
                    className="flex-1 rounded-lg bg-[#4A7CFF] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#3F6DE8]"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}

function SidebarAccountSection({
  title,
  total,
  collapsed,
  onToggle,
  onAdd,
  children,
  tone = "green",
}: {
  title: string;
  total: number;
  collapsed: boolean;
  onToggle: () => void;
  onAdd: () => void;
  children: ReactNode;
  tone?: "green" | "red";
}) {
  return (
    <section>
      <div className="group flex items-center gap-2 px-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-[#8B90B0] hover:text-white"
        >
          <ChevronDown
            className={`h-3 w-3 shrink-0 transition ${collapsed ? "-rotate-90" : ""}`}
          />
          <span className="truncate">{title}</span>
        </button>
        <span
          className={`shrink-0 text-[11px] tabular-nums ${
            tone === "red" && total < 0 ? "text-[#F5A598]" : "text-[#8B90B0]"
          }`}
        >
          {formatJPY(total)}
        </span>
        <button
          type="button"
          onClick={onAdd}
          aria-label="Add account"
          className="rounded-md p-1 text-[#8B90B0] opacity-0 transition hover:bg-white/[0.06] hover:text-white group-hover:opacity-100"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="mt-1 overflow-hidden"
          >
            <div className="space-y-0.5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function SidebarAccountRow({
  account,
  onClick,
  onEdit,
}: {
  account: Account;
  onClick: () => void;
  onEdit: (changes: Partial<Account>) => void;
}) {
  const editAccount = () => {
    const name = window.prompt("Account name", account.name);
    if (!name) return;
    onEdit({ name });
  };
  const archiveAccount = () => onEdit({ isArchived: true } as Partial<Account>);
  return (
    <button
      type="button"
      onClick={onClick}
      onContextMenu={(event) => {
        event.preventDefault();
        if (window.confirm("Edit this account? Choose Cancel to archive instead.")) editAccount();
        else archiveAccount();
      }}
      className="flex h-8 w-full min-w-0 items-center gap-2 rounded-md px-3 text-left text-[13px] text-[#8B90B0] hover:bg-white/[0.06] hover:text-white"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="min-w-0 flex-1 truncate">{account.name}</span>
        </TooltipTrigger>
        <TooltipContent side="right">{account.name}</TooltipContent>
      </Tooltip>
      <span
        className={`shrink-0 text-right tabular-nums ${
          account.balanceYen < 0 ? "text-[#F5A598]" : "text-white/90"
        }`}
      >
        {formatJPY(account.balanceYen)}
      </span>
    </button>
  );
}

function EmptySectionHint({ children }: { children: ReactNode }) {
  return (
    <p className="px-3 py-1.5 text-[11px] italic text-[#8B90B0]/70">{children}</p>
  );
}

function SidebarModalInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-[#E8E7E3] bg-white px-3 py-2 text-sm outline-none focus:border-[#4A7CFF]"
      />
    </label>
  );
}
