"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
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
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [pathname]);

  const renderNavItems = () =>
    NAV_ITEMS.map((item) => {
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
    });

  return (
    <div className="relative flex min-h-screen bg-[#f6f1ea] text-[#3d3128]">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 overflow-hidden">
        <div className="mx-auto h-[420px] w-[720px] -rotate-[12deg] rounded-[140px] bg-[#f2dec9] blur-[120px]" />
        <div className="absolute -top-24 right-[-160px] h-72 w-72 rounded-full bg-[#f6e1cb] opacity-80 blur-[160px]" />
        <div className="absolute bottom-10 left-[-120px] h-64 w-64 rounded-full bg-[#ead8c4] opacity-70 blur-[160px]" />
      </div>

      <aside className="relative hidden w-72 flex-shrink-0 border-r border-[#e3d4c2] bg-white/70 px-7 py-8 backdrop-blur lg:flex lg:flex-col">
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
          {renderNavItems()}
        </nav>
        <div className="mt-auto rounded-2xl border border-[#e3d4c2] bg-[#fffaf5] px-5 py-4 text-xs text-[#7f6b5a] shadow-sm">
          <p className="font-semibold text-[#3d3128]">今日のひと息</p>
          <p className="mt-1 leading-relaxed">
            小さな気づきや感情を自然に共有できる環境づくりを目指しています。
          </p>
        </div>
      </aside>

      <main className="relative flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#e3d4c2] bg-white/60 px-4 text-sm text-[#7f6b5a] backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#e3d4c2] bg-white/90 text-[#ad7a46] shadow-sm backdrop-blur transition-all duration-200 hover:border-[#c89b6d] focus:outline-none focus:ring-2 focus:ring-[#f1e6d8] lg:hidden"
              aria-label="メニューを開く"
              aria-expanded={isMobileNavOpen}
              onClick={() => setIsMobileNavOpen((prev) => !prev)}
            >
              <span className="relative block h-4 w-4">
                <span
                  className={[
                    "absolute left-0 h-[2px] w-full rounded-full bg-current transition-transform duration-200",
                    isMobileNavOpen ? "top-1/2 rotate-45" : "top-0",
                  ].join(" ")}
                />
                <span
                  className={[
                    "absolute left-0 h-[2px] w-full rounded-full bg-current transition-opacity duration-200",
                    isMobileNavOpen ? "top-1/2 opacity-0" : "top-1/2",
                  ].join(" ")}
                />
                <span
                  className={[
                    "absolute left-0 h-[2px] w-full rounded-full bg-current transition-transform duration-200",
                    isMobileNavOpen
                      ? "bottom-1/2 -rotate-45"
                      : "bottom-0",
                  ].join(" ")}
                />
              </span>
            </button>
            <div className="flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-medium text-[#ad7a46] shadow-sm backdrop-blur">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#c89b6d]" />
              <span>Asia/Taipei (UTC+8)</span>
            </div>
          </div>
          <span className="rounded-full bg-[#f1e6d8] px-3 py-1 text-xs font-semibold text-[#ad7a46]">
            β 開発中
          </span>
        </header>

        <section className="relative flex-1 px-4 py-10 md:px-8">
          <div className="mx-auto max-w-5xl space-y-10 rounded-[32px] bg-white/70 px-4 py-8 shadow-[0_45px_80px_-60px_rgba(61,49,40,0.5)] backdrop-blur md:px-10">
            {children}
          </div>
        </section>
      </main>

      {isMobileNavOpen && (
        <div className="fixed inset-0 z-40 bg-[#3d3128]/40 backdrop-blur-sm lg:hidden">
          <div className="absolute bottom-0 left-0 right-0 mx-auto w-full max-w-sm rounded-t-3xl border border-[#e3d4c2]/60 bg-[#fffaf5]/95 p-6 shadow-2xl">
            <div className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-[#ad7a46]">
              Navigate
            </div>
            <nav className="space-y-2 text-sm font-medium text-[#7f6b5a]">
              {renderNavItems()}
            </nav>
            <div className="mt-6 text-[11px] text-[#b59b85]">
              小さなリズムでも継続すると、チームの温度が見えてきます。
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
