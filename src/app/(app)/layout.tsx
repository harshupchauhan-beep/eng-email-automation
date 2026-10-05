import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      user={{
        name: "Local operator",
        email: "operator@local",
        role: "ADMIN",
      }}
    >
      {children}
    </AppShell>
  );
}
