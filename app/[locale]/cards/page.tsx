import { AppShell } from "@/components/app/app-shell"
import { PageHeader } from "@/components/app/page-header"
import { CardsView } from "@/components/app/cards-view"

export default function CardsPage() {
  return (
    <AppShell>
      <PageHeader title="Cards" />
      <CardsView />
    </AppShell>
  )
}
