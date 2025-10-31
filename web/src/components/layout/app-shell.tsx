"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { APP_NAME } from "@/config/constants";

const NAV_ITEMS = [
  { href: "/dashboard", label: "ダッシュボード" },
  { href: "/daily-reports", label: "デイリーレポート" },
  { href: "/daily-reports/new", label: "DR投稿" },
  { href: "/tasks", label: "タスク" },
  { href: "/settings", label: "設定" },
];

interface AppShellProps {
  children: ReactNode;
}

export const AppShell = ({ children }: AppShellProps) => {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="hidden w-64 flex-shrink-0 border-r border-slate-200 bg-white/80 p-6 lg:block">
        <div className="mb-10 text-xl font-semibold text-slate-900">
          {APP_NAME}
        </div>
        <nav className="space-y-2">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white/70 px-6 py-4 text-sm text-slate-500">
          <span>Asia/Taipei (UTC+8)</span>
          <span>β 開発中</span>
        </header>
        <section className="flex-1 px-6 py-8">{children}</section>
      </main>
    </div>
  );
};
