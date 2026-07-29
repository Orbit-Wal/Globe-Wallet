import React from 'react'
import { NextIntlClientProvider } from 'next-intl'
import messages from '../../messages/en.json'

/**
 * #127 wired several components into next-intl's useTranslations(), which
 * throws outside a NextIntlClientProvider. Shared wrapper so each test file
 * doesn't repeat the same messages import/provider boilerplate.
 */
export function IntlTestProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}
