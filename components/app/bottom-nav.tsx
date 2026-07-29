"use client"

import { Home, ArrowLeftRight, CreditCard, PiggyBank, User } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { SAFE_AREA_BOTTOM_NAV_PB } from "@/lib/a11y/safe-area"

const navItems = [
  { icon: Home,           labelKey: "bottomNav.home",    href: "/"        },
  { icon: ArrowLeftRight, labelKey: "bottomNav.send",    href: "/send"    },
  { icon: CreditCard,     labelKey: "bottomNav.cards",   href: "/cards"   },
  { icon: PiggyBank,      labelKey: "bottomNav.savings", href: "/savings" },
  { icon: User,           labelKey: "bottomNav.profile", href: "/profile" },
]

export function BottomNav() {
  const pathname = usePathname()
  const t = useTranslations()

  return (
    <nav
      className="fixed bottom-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 border-t border-border bg-card/95 backdrop-blur-md"
      data-testid="bottom-nav"
      aria-label="Main navigation"
    >
      <ul
        role="list"
        className="flex items-center justify-around px-2 pt-2"
        style={{ paddingBottom: SAFE_AREA_BOTTOM_NAV_PB }}
      >
        {navItems.map((item) => {
          const isActive = pathname.endsWith(item.href)
          const label = t(item.labelKey)
          return (
            <li key={item.labelKey} className="flex-1">
              <Link
                href={item.href}
                data-testid={`nav-${label.toLowerCase()}`}
                aria-current={isActive ? "page" : undefined}
                aria-label={label}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl py-1.5 text-[10px] font-medium transition-all duration-300",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                      : "bg-transparent",
                  )}
                  aria-hidden="true"
                >
                  <item.icon className="h-5 w-5" />
                </span>
                <span aria-hidden="true">{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
