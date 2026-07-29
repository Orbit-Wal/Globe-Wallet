"use client"

import {
  Moon,
  ShieldCheck,
  BadgeCheck,
  Bell,
  HelpCircle,
  Globe,
  ChevronRight,
  LogOut,
  Fingerprint,
} from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { AccountSwitcher } from "@/components/app/account-switcher"
import { useActiveAccount } from "@/hooks/useActiveAccount"
import { useFinanceServices } from "@/hooks/useFinanceServices"

export function ProfileView() {
  const { theme, setTheme } = useTheme()
  const isDark = theme === "dark"
  const { activeAccount } = useActiveAccount()
  const { wallet } = useFinanceServices()

  return (
    <div className="px-4 pt-5">
      <Card className="flex flex-col items-center p-6 text-center">
        <Avatar className="h-20 w-20 border-4 border-primary/15">
          <AvatarImage src="/professional-avatar.jpg" alt="Profile photo" />
          <AvatarFallback className="bg-primary text-xl text-primary-foreground">TA</AvatarFallback>
        </Avatar>
        <h2 className="mt-3 text-lg font-bold text-foreground">Tunde Adeyemi</h2>
        <p className="text-sm text-muted-foreground">tunde@globewallet.app</p>
        <span className="mt-2 flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <BadgeCheck className="h-3.5 w-3.5" /> Verified - Tier 3
        </span>
      </Card>

      <SettingsGroup title="Wallets">
        <div className="space-y-2 px-4 py-3.5" data-testid="profile-account-switcher">
          <p className="text-xs text-muted-foreground">Active Stellar account</p>
          <AccountSwitcher />
          <p className="font-mono text-[11px] text-muted-foreground">
            {wallet.shortenKey(activeAccount.publicKey)} · {activeAccount.name}
          </p>
        </div>
      </SettingsGroup>

      <SettingsGroup title="Preferences">
        <ToggleRow
          icon={Moon}
          label="Dark mode"
          checked={isDark}
          onCheckedChange={(v) => setTheme(v ? "dark" : "light")}
        />
        <ToggleRow icon={Fingerprint} label="Biometric login" checked />
        <ToggleRow icon={Bell} label="Push notifications" checked />
      </SettingsGroup>

      <SettingsGroup title="Account">
        <LinkRow icon={ShieldCheck} label="Security & PIN" />
        <LinkRow icon={Globe} label="Currency & region" value="NGN" />
        <LinkRow icon={HelpCircle} label="Help & support" />
      </SettingsGroup>

      <Button variant="outline" className="mt-5 w-full border-destructive/30 bg-transparent text-destructive hover:bg-destructive/10 hover:text-destructive">
        <LogOut className="h-4 w-4" /> Log out
      </Button>

      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        Globe Wallet - Settled on the Stellar Network - v1.0.0
      </p>
    </div>
  )
}

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <Card className="divide-y divide-border p-0">{children}</Card>
    </div>
  )
}

function ToggleRow({
  icon: Icon,
  label,
  checked,
  onCheckedChange,
}: {
  icon: React.ElementType
  label: string
  checked?: boolean
  onCheckedChange?: (v: boolean) => void
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1 text-sm font-medium text-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

function LinkRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string }) {
  return (
    <button type="button" className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-secondary">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1 text-sm font-medium text-foreground">{label}</span>
      {value && <span className="text-xs text-muted-foreground">{value}</span>}
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  )
}
