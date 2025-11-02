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
    <div className="flex min-h-screen bg-[#f6f1ea] text-[#3d3128]">
      <aside className="hidden w-72 flex-shrink-0 border-r border-[#e3d4c2] bg-white/70 px-7 py-8 backdrop-blur lg:flex lg:flex-col">
        <div className="mb-10 rounded-3xl bg-[#c89b6d] px-5 py-6 text-white shadow-xl shadow-[#c89b6d]/30">
          <p className="text-xs uppercase tracking-[0.18em] text-white/70">
            Team Pulse
          </p>
          <div className="mt-2 text-2xl font-semibold">{APP_NAME}</div>
          <p className="mt-3 text-[13px] text-white/80">
            毎日のコンディションを、ミルクティーのように柔らかく共有。
          </p>
        </div>
        <nav className="space-y-1 text-sm font-medium text-[#7f6b5a]">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "flex items-center rounded-xl px-4 py-2.5 transition-colors duration-200",
                  isActive
                    ? "bg-[#c89b6d] text-white shadow-sm shadow-[#c89b6d]/30"
                    : "hover:bg-[#f1e6d8] hover:text-[#3d3128]",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto rounded-2xl border border-[#e3d4c2] bg-[#fffaf5] px-5 py-4 text-xs text-[#7f6b5a] shadow-sm">
          <p className="font-semibold text-[#3d3128]">今日のひと息</p>
          <p className="mt-1 leading-relaxed">
            小さな気づきや感情を自然に共有できる環境づくりを目指しています。
          </p>
        </div>
      </aside>
      <main className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-[#e3d4c2] bg-white/60 px-8 text-sm text-[#7f6b5a] backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-[#c89b6d]" />
            <span>Asia/Taipei (UTC+8)</span>
          </div>
          <span className="rounded-full bg-[#f1e6d8] px-3 py-1 text-xs font-semibold text-[#ad7a46]">
            β 開発中
          </span>
        </header>
        <section className="flex-1 px-8 py-10">
          <div className="mx-auto max-w-5xl">
            {children}
          </div>
        </section>
      </main>
    </div>
  );
};
