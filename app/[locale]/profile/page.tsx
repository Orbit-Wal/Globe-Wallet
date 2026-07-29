import { AppShell } from "@/components/app/app-shell"
import { PageHeader } from "@/components/app/page-header"
import { ProfileView } from "@/components/app/profile-view"

export default function ProfilePage() {
  return (
    <AppShell>
      <PageHeader title="Profile" />
      <ProfileView />
    </AppShell>
  )
}
