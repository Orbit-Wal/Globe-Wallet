import { NextRequest, NextResponse } from 'next/server'
import { financeServices } from '../../../lib/services/container'

export async function GET(request?: NextRequest) {
  try {
    const accountId = request?.nextUrl.searchParams.get('accountId') ?? undefined
    const account = financeServices.wallet.getAccountInfo(accountId)
    const accounts = financeServices.wallet.listAccounts()
    const offRampMethods = financeServices.offRamp.getMethods()
    
    return NextResponse.json({ 
      success: true, 
      data: { 
        account,
        accounts,
        activeAccountId: financeServices.wallet.getActiveAccountId(),
        offRampMethods 
      } 
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, data } = await request.json()
    const accountId = data?.accountId as string | undefined

    switch (action) {
      case 'validateAddress': {
        const isValid = financeServices.wallet.validateAddress(data.address)
        return NextResponse.json({ success: true, data: { isValid } })
      }
      
      case 'generateAddress': {
        const address = financeServices.wallet.generateReceiveAddress(accountId)
        return NextResponse.json({ success: true, data: { address } })
      }

      case 'switchAccount': {
        if (!accountId) {
          return NextResponse.json(
            { success: false, error: 'accountId is required' },
            { status: 400 },
          )
        }
        const switched = financeServices.wallet.switchAccount(accountId)
        return NextResponse.json({
          success: true,
          data: { account: financeServices.wallet.getAccountInfo(switched.id) },
        })
      }

      case 'getOffRampRate': {
        const rates = await financeServices.offRamp.getRates()
        const rate = rates[data.currency] ?? 1.0
        return NextResponse.json({ success: true, data: { currency: data.currency, rate } })
      }
      
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Invalid request' },
      { status: 400 }
    )
  }
}
