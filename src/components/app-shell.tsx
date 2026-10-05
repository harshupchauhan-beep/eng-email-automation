"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Tags,
  FileText,
  Send,
  ShieldOff,
  Settings,
  ScrollText,
  Sparkles,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV_GROUPS = [
  {
    label: "Intelligence",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/contacts", label: "Contacts", icon: Users },
      { href: "/segments", label: "Segments", icon: Tags },
      { href: "/suppression", label: "Suppression", icon: ShieldOff },
    ],
  },
  {
    label: "Campaigns",
    items: [
      { href: "/campaigns", label: "Campaigns", icon: Send },
      { href: "/templates", label: "Templates", icon: FileText },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/audit-logs", label: "Audit logs", icon: ScrollText },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-3 rounded-xl px-1 py-1 transition-opacity hover:opacity-90">
      <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_0_24px_oklch(0.78_0.11_195/35%)]">
        <Sparkles className="size-4" />
      </div>
      <div className={cn(compact && "hidden sm:block")}>
        <div className="text-[11px] font-semibold tracking-[0.18em] text-primary">ICCPP</div>
        <div className="text-sm font-semibold leading-tight">Email Intelligence</div>
      </div>
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-5 px-3 py-2">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {group.label}
          </div>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-all",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
                  )}
                >
                  <item.icon className={cn("size-4", active && "text-primary")} />
                  {item.label}
                  {active ? <span className="ml-auto size-1.5 rounded-full bg-primary" /> : null}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function Clock() {
  const [now, setNow] = useState<string>("");
  useEffect(() => {
    const tick = () => setNow(new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC");
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono text-xs text-muted-foreground">{now || "—"}</span>;
}

export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: { name: string; email: string; role: string };
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const current = NAV_GROUPS.flatMap((g) => g.items).find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="px-4 py-5">
          <BrandLockup />
        </div>
        <NavLinks />
        <div className="border-t border-sidebar-border p-4">
          <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-3">
            <div className="truncate text-sm font-medium">{user.name}</div>
            <div className="truncate text-xs text-muted-foreground">{user.email}</div>
            <Badge variant="outline" className="mt-2 font-mono text-[10px]">
              {user.role}
            </Badge>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-md md:px-8">
          <div className="flex items-center gap-3">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <div className="px-4 py-5">
                  <BrandLockup />
                </div>
                <NavLinks onNavigate={() => setOpen(false)} />
              </SheetContent>
            </Sheet>
            <div className="md:hidden">
              <BrandLockup compact />
            </div>
            <div className="hidden md:block">
              <div className="text-xs text-muted-foreground">ICCPP Email Intelligence System</div>
              <div className="text-sm font-medium">{current?.label ?? "Workspace"}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1 sm:flex">
              <span className="live-dot size-2 rounded-full bg-primary" />
              <span className="text-xs text-muted-foreground">Operations live</span>
            </div>
            <Clock />
            <ThemeToggle />
          </div>
        </header>
        <main className="app-grid flex-1 overflow-auto p-4 md:p-8">
          <div className="animate-enter mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
