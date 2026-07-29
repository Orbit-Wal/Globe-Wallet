import { AppShell } from "@/components/app/app-shell"
import { PageHeader } from "@/components/app/page-header"
import { SendForm } from "@/components/app/send-form"

export default function SendPage() {
  return (
    <AppShell>
      <PageHeader title="Send Money" />
      <SendForm />
    </AppShell>
  )
}
