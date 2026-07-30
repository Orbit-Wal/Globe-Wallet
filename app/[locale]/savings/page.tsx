import { AppShell } from "@/components/app/app-shell"
import { PageHeader } from "@/components/app/page-header"
import { SavingsView } from "@/components/app/savings-view"

export default function SavingsPage() {
  return (
    <AppShell>
      <PageHeader title="Savings" />
      <SavingsView />
    </AppShell>
  )
}
