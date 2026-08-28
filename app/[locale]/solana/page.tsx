import { AppShell } from "@/components/app/app-shell"
import { SolanaWalletCard } from "@/components/app/solana-wallet-card"

export default function SolanaPage() {
  return (
    <AppShell>
      <SolanaWalletCard />
    </AppShell>
  )
}
