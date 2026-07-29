"use client"

import { AppShell } from "@/components/app/app-shell"
import { PageHeader } from "@/components/app/page-header"
import { ReceiveForm } from "@/components/app/receive-form"

export default function ReceivePage() {
  return (
    <AppShell>
      <PageHeader title="Receive XLM" back="/" />
      <div className="px-4 pb-4" data-testid="receive-page">
        <ReceiveForm />
      </div>
    </AppShell>
  )
}
