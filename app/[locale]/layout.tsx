import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "@/components/theme-provider"
import { FinanceServicesProvider } from "@/hooks/useFinanceServices"
import { ActiveAccountProvider } from "@/hooks/useActiveAccount"
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register"
import { OfflineBanner } from "@/components/ui/offline-banner"
import { NextIntlClientProvider } from "next-intl"
import { getMessages } from "next-intl/server"
import { notFound } from "next/navigation"
import "./globals.css"
import "@/lib/tracing/browser-tracer"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

const locales = ['en', 'ar']

export const viewport: Viewport = {
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#10b981',
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!locales.includes(locale)) notFound()
  
  const t = (await import(`@/messages/${locale}.json`)).default

  return {
    title: t.app.title,
    description: t.app.description,
    generator: "v0.app",
    manifest: "/manifest.json",
    icons: {
      icon: [
        {
          url: "/icon-light-32x32.png",
          media: "(prefers-color-scheme: light)",
        },
        {
          url: "/icon-dark-32x32.png",
          media: "(prefers-color-scheme: dark)",
        },
        {
          url: "/icon.svg",
          type: "image/svg+xml",
        },
      ],
      apple: "/apple-icon.png",
    },
  }
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode,
  params: Promise<{ locale: string }>
}>) {
  const { locale } = await params
  if (!locales.includes(locale)) notFound()

  const messages = await getMessages()
  const dir = locale === 'ar' ? 'rtl' : 'ltr'

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body className={`font-sans antialiased`}>
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
            storageKey="tasko-theme"
          >
            <FinanceServicesProvider>
              <ActiveAccountProvider>
                <OfflineBanner />
                {children}
              </ActiveAccountProvider>
            </FinanceServicesProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
        <Analytics />
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
