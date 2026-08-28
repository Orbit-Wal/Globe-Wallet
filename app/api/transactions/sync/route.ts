import { NextRequest, NextResponse } from 'next/server'
import { transactionSyncService } from '../../../../lib/services/transaction-sync.service'
import { requireAuth } from '@/lib/api/http'

interface SyncResponse {
  success: boolean
  data?: {
    added: number
    updated: number
    failed: number
    lastSyncAt: string
  }
  error?: string
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request)
  if (authError) return authError

  try {
    const result = await transactionSyncService.syncFromNetwork()
    return NextResponse.json<SyncResponse>({ success: true, data: result })
  } catch (error) {
    return NextResponse.json<SyncResponse>(
      { success: false, error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  const authError = requireAuth(request)
  if (authError) return authError

  try {
    const status = transactionSyncService.getSyncStatus()
    return NextResponse.json({ success: true, data: status })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
