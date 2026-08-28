/** @jest-environment node */
import { NextResponse } from 'next/server'
import { shellService } from '@/lib/services/shell.service'
import type { ShellConfigResponse } from '@/lib/types'

// Issue #68: intentionally PUBLIC — static app-shell config needed before
// a session exists (pre-login UI chrome), no user data.
export async function GET(): Promise<NextResponse<ShellConfigResponse>> {
  try {
    const config = shellService.getConfig()
    return NextResponse.json({ success: true, config })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
