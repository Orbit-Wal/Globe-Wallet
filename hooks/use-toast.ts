'use client'

import { toast as sonnerToast } from 'sonner'

export type ToastInput = {
  title?: string
  description?: string
  variant?: 'default' | 'destructive'
}

/**
 * Thin adapter used by trustline flows. Keeps the historical `{ toast }` hook
 * shape while routing notifications through the app's sonner toaster.
 */
export function useToast() {
  return {
    toast({ title, description, variant }: ToastInput) {
      const message = title ?? description ?? ''
      const options = description && title ? { description } : undefined
      if (variant === 'destructive') {
        sonnerToast.error(message, options)
        return
      }
      sonnerToast.success(message, options)
    },
  }
}
