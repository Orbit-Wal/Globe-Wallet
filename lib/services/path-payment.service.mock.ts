import { BaseService } from './base.service'
import {
  AssetCode,
  ExecutePathPaymentParams,
  IPathPaymentService,
  NoPathFoundError,
  PathPaymentExecutionResult,
  PathPaymentParams,
  PaymentQuote,
  StaleQuoteError,
  StellarServiceError,
} from '../types'

const MOCK_RATES: Record<string, number> = {
  XLM_USDC: 0.095,
  XLM_USDT: 0.095,
  USDC_XLM: 10.526,
  USDT_XLM: 10.526,
  USDC_USDT: 1.0,
  USDT_USDC: 1.0,
}

export class PathPaymentMockService extends BaseService implements IPathPaymentService {
  constructor() {
    super('PathPaymentMockService')
  }

  async findQuote(params: PathPaymentParams): Promise<PaymentQuote> {
    return this.withPerformanceTracking('PathPaymentMockService.findQuote', async () => {
      const { sourceAsset, destinationAsset, amount, mode, slippageTolerance = 0.5 } = params

      const numAmount = parseFloat(amount)
      if (isNaN(numAmount) || numAmount <= 0) {
        throw new StellarServiceError('Invalid amount for path payment quote')
      }

      if (sourceAsset === destinationAsset) {
        const createdAt = Date.now()
        const formattedAmount = numAmount.toFixed(7)
        return {
          mode,
          sourceAsset,
          destinationAsset,
          executableSourceAmount: formattedAmount,
          executableDestinationAmount: formattedAmount,
          path: [],
          estimatedPrice: 1.0,
          priceImpact: 0,
          slippageTolerance,
          destMin: formattedAmount,
          sendMax: formattedAmount,
          expiresAt: createdAt + 15000,
          createdAt,
        }
      }

      const rateKey = `${sourceAsset}_${destinationAsset}`
      const rate = MOCK_RATES[rateKey] || 0.1

      let execSourceAmount: string
      let execDestAmount: string

      if (mode === 'strictSend') {
        execSourceAmount = numAmount.toFixed(7)
        execDestAmount = (numAmount * rate).toFixed(7)
      } else {
        execDestAmount = numAmount.toFixed(7)
        execSourceAmount = (numAmount / rate).toFixed(7)
      }

      const destNum = parseFloat(execDestAmount)
      const srcNum = parseFloat(execSourceAmount)

      const destMin = (destNum * (1 - slippageTolerance / 100)).toFixed(7)
      const sendMax = (srcNum * (1 + slippageTolerance / 100)).toFixed(7)
      const createdAt = Date.now()

      return {
        mode,
        sourceAsset,
        destinationAsset,
        executableSourceAmount: execSourceAmount,
        executableDestinationAmount: execDestAmount,
        path: [
          {
            code: 'USDT',
            issuer: 'GBBC5SZESQ72TGN5SF436MEB76W5T7XTNO4ODJT2SKRP4MUYSVS6XZGE',
            type: 'credit_alphanum4',
          },
        ],
        estimatedPrice: rate,
        priceImpact: 0.05,
        slippageTolerance,
        destMin,
        sendMax,
        expiresAt: createdAt + 15000,
        createdAt,
      }
    })
  }

  async executePayment(params: ExecutePathPaymentParams): Promise<PathPaymentExecutionResult> {
    return this.withPerformanceTracking('PathPaymentMockService.executePayment', async () => {
      const { quote } = params

      if (Date.now() > quote.expiresAt) {
        throw new StaleQuoteError()
      }

      return {
        success: true,
        hash: `mock_path_tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        ledger: 1000000 + Math.floor(Math.random() * 50000),
        sourceAmountPaid: quote.executableSourceAmount,
        destinationAmountReceived: quote.executableDestinationAmount,
      }
    })
  }
}

export const pathPaymentMockService = new PathPaymentMockService()
