"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, LayoutDashboard, LogOut, Menu, Settings, X } from "lucide-react";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { ToolIcon } from "./tool-icon";
import { useAuth } from "./auth-provider";
import { toolsByCategory, type CategoryId } from "@/lib/tools";
import { cn } from "@/lib/utils";

const MENUS: { label: string; category: CategoryId }[] = [
  { label: "Convert", category: "convert" },
  { label: "Edit PDF", category: "edit" },
  { label: "Security", category: "security" },
];

function Dropdown({ label, category }: { label: string; category: CategoryId }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const tools = toolsByCategory(category);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
    >
      <button
        type="button"
        className={cn(
          "flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition",
          open ? "text-ink" : "text-muted hover:text-ink",
        )}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
      >
        {label}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            className="absolute left-1/2 top-full z-50 w-[520px] -translate-x-1/2 pt-2"
          >
            <div className="card grid grid-cols-2 gap-1 p-2 shadow-lift">
              {tools.map((t) => (
                <Link
                  key={t.slug}
                  href={`/${t.slug}`}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-3 rounded-xl p-2.5 transition hover:bg-brand-soft"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-ink">
                    <ToolIcon slug={t.slug} className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-ink">{t.name}</span>
                    <span className="line-clamp-1 text-xs text-muted">{t.short}</span>
                  </span>
                </Link>
              ))}
              <Link
                href={`/tools?category=${category}`}
                onClick={() => setOpen(false)}
                className="col-span-2 mt-1 rounded-xl border-t border-line px-3 pt-2.5 pb-1 text-xs font-semibold text-brand-ink hover:underline"
              >
                View all {label.toLowerCase()} tools →
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  if (!user) return null;
  const initials = (user.name || user.email).slice(0, 1).toUpperCase();
  return (
    <div className="relative" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 items-center gap-2 rounded-xl border border-line px-2 pr-3 text-sm font-medium hover:bg-brand-soft"
        aria-expanded={open}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-xs font-bold text-[#171717]">{initials}</span>
        <span className="max-w-28 truncate">{user.name || "Account"}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 w-52 pt-2">
          <div className="card p-1.5 shadow-lift">
            <Link href="/dashboard" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-brand-soft">
              <LayoutDashboard className="h-4 w-4" /> Dashboard
            </Link>
            <Link href="/settings" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-brand-soft">
              <Settings className="h-4 w-4" /> Account settings
            </Link>
            <button
              type="button"
              onClick={async () => {
                await logout();
                router.push("/");
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-danger-soft"
            >
              <LogOut className="h-4 w-4" /> Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState<CategoryId | null>(null);

  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
  }, [mobileOpen]);

  const linkCls = (href: string) =>
    cn(
      "rounded-lg px-3 py-2 text-sm font-medium transition",
      pathname === href ? "text-ink" : "text-muted hover:text-ink",
    );

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-xl">
      <nav className="container-page flex h-16 items-center justify-between gap-4" aria-label="Main">
        <Logo />

        <div className="hidden items-center lg:flex">
          <Link href="/" className={linkCls("/")}>Home</Link>
          <Link href="/tools" className={linkCls("/tools")}>All PDF Tools</Link>
          {MENUS.map((m) => (
            <Dropdown key={m.category} {...m} />
          ))}
          <Link href="/about" className={linkCls("/about")}>About Us</Link>
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <ThemeToggle />
          {!loading && !user && (
            <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-ink hover:text-brand-ink">
              Login / Sign Up
            </Link>
          )}
          <UserMenu />
          <Link href="/tools" className="btn-primary">Get Started</Link>
        </div>

        <div className="flex items-center gap-1 lg:hidden">
          <ThemeToggle />
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-ink hover:bg-brand-soft"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "calc(100dvh - 4rem)" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-y-auto border-t border-line bg-bg lg:hidden"
          >
            <div className="container-page flex flex-col gap-1 py-4">
              <Link href="/" className="rounded-xl px-3 py-3 text-base font-medium hover:bg-brand-soft">Home</Link>
              <Link href="/tools" className="rounded-xl px-3 py-3 text-base font-medium hover:bg-brand-soft">All PDF Tools</Link>
              {MENUS.map((m) => (
                <div key={m.category}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-base font-medium hover:bg-brand-soft"
                    onClick={() => setExpanded((e) => (e === m.category ? null : m.category))}
                    aria-expanded={expanded === m.category}
                  >
                    {m.label}
                    <ChevronDown className={cn("h-4 w-4 transition-transform", expanded === m.category && "rotate-180")} />
                  </button>
                  {expanded === m.category && (
                    <div className="grid gap-1 pb-2 pl-3">
                      {toolsByCategory(m.category).map((t) => (
                        <Link key={t.slug} href={`/${t.slug}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-brand-soft">
                          <ToolIcon slug={t.slug} className="h-4 w-4 text-brand-ink" />
                          {t.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <Link href="/about" className="rounded-xl px-3 py-3 text-base font-medium hover:bg-brand-soft">About Us</Link>
              <div className="mt-4 grid gap-2 border-t border-line pt-4">
                {user ? (
                  <>
                    <Link href="/dashboard" className="btn-ghost">Dashboard</Link>
                    <button type="button" className="btn-ghost" onClick={() => void logout()}>Log out</button>
                  </>
                ) : (
                  <Link href="/login" className="btn-ghost">Login / Sign Up</Link>
                )}
                <Link href="/tools" className="btn-primary">Get Started</Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
