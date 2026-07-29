import { Horizon, Asset, Operation, TransactionBuilder, Keypair, Networks } from '@stellar/stellar-sdk'
import { BaseService } from './base.service'
import {
  AssetCode,
  ExecutePathPaymentParams,
  IPathPaymentService,
  NoPathFoundError,
  PathPaymentExecutionResult,
  PathPaymentParams,
  PaymentHopAsset,
  PaymentQuote,
  SlippageExceededError,
  StaleQuoteError,
  StellarServiceError,
} from '../types'

// Default known issuers on testnet for token assets
const TESTNET_ISSUERS: Record<string, string> = {
  USDC: 'GCIYWXKJ6HCYQBB3FFLMHHALEBR5D3WZIJWA4DY65CI5ODAWECJKFUJE',
  USDT: 'GBBC5SZESQ72TGN5SF436MEB76W5T7XTNO4ODJT2SKRP4MUYSVS6XZGE',
}

export class PathPaymentService extends BaseService implements IPathPaymentService {
  private horizonUrl: string
  private server: Horizon.Server

  constructor(horizonUrl?: string, server?: Horizon.Server) {
    super('PathPaymentService')
    this.horizonUrl = horizonUrl || process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org'
    this.server = server || new Horizon.Server(this.horizonUrl)
  }

  private resolveStellarAsset(code: AssetCode): Asset {
    if (code === 'XLM') {
      return Asset.native()
    }
    const issuer = TESTNET_ISSUERS[code] || 'GCIYWXKJ6HCYQBB3FFLMHHALEBR5D3WZIJWA4DY65CI5ODAWECJKFUJE'
    return new Asset(code, issuer)
  }

  private formatHopAsset(asset: any): PaymentHopAsset {
    if (asset.asset_type === 'native' || asset.code === 'XLM') {
      return { code: 'XLM', type: 'native' }
    }
    return {
      code: asset.asset_code || asset.code || 'UNKNOWN',
      issuer: asset.asset_issuer || asset.issuer,
      type: asset.asset_type || 'credit_alphanum4',
    }
  }

  async findQuote(params: PathPaymentParams): Promise<PaymentQuote> {
    return this.withPerformanceTracking('PathPaymentService.findQuote', async () => {
      const {
        sourceAsset,
        destinationAsset,
        amount,
        mode,
        slippageTolerance = 0.5,
        destinationAccount = 'GCIYWXKJ6HCYQBB3FFLMHHALEBR5D3WZIJWA4DY65CI5ODAWECJKFUJE',
      } = params

      const numAmount = parseFloat(amount)
      if (isNaN(numAmount) || numAmount <= 0) {
        throw new StellarServiceError('Invalid amount for path payment quote')
      }

      if (sourceAsset === destinationAsset) {
        // Direct 1:1 conversion for same asset
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

      const srcStellarAsset = this.resolveStellarAsset(sourceAsset)
      const destStellarAsset = this.resolveStellarAsset(destinationAsset)

      try {
        if (mode === 'strictSend') {
          return await this.fetchStrictSendQuote({
            sourceAsset,
            destinationAsset,
            srcStellarAsset,
            destStellarAsset,
            sendAmount: numAmount,
            slippageTolerance,
            destinationAccount,
          })
        } else {
          return await this.fetchStrictReceiveQuote({
            sourceAsset,
            destinationAsset,
            srcStellarAsset,
            destStellarAsset,
            destAmount: numAmount,
            slippageTolerance,
            destinationAccount,
          })
        }
      } catch (err: any) {
        if (err instanceof NoPathFoundError || err instanceof StellarServiceError) {
          throw err
        }
        if (err.response?.status === 404 || err.status === 404) {
          throw new NoPathFoundError(`No conversion path found from ${sourceAsset} to ${destinationAsset}`)
        }
        if (err.message && err.message.toLowerCase().includes('network')) {
          throw new Error(`Network failure: ${err.message}`)
        }
        throw new Error(`Failed to find path payment quote: ${err instanceof Error ? err.message : String(err)}`)
      }
    })
  }

  private async fetchStrictSendQuote(options: {
    sourceAsset: AssetCode
    destinationAsset: AssetCode
    srcStellarAsset: Asset
    destStellarAsset: Asset
    sendAmount: number
    slippageTolerance: number
    destinationAccount: string
  }): Promise<PaymentQuote> {
    const { sourceAsset, destinationAsset, srcStellarAsset, destStellarAsset, sendAmount, slippageTolerance, destinationAccount } = options

    const response = await this.server
      .strictSendPaths(srcStellarAsset, sendAmount.toString(), [destStellarAsset])
      .call()

    if (!response.records || response.records.length === 0) {
      throw new NoPathFoundError(`No payment path available for sending ${sendAmount} ${sourceAsset} to ${destinationAsset}`)
    }

    // Pick path with highest destination amount
    const sorted = [...response.records].sort(
      (a, b) => parseFloat(b.destination_amount) - parseFloat(a.destination_amount)
    )
    const bestPath = sorted[0]

    const execSourceAmount = sendAmount.toFixed(7)
    const execDestAmount = parseFloat(bestPath.destination_amount).toFixed(7)
    const destAmountNum = parseFloat(execDestAmount)
    const estimatedPrice = destAmountNum / sendAmount

    // Slippage: min destination amount
    const minDestNum = destAmountNum * (1 - slippageTolerance / 100)
    const destMin = Math.max(0, minDestNum).toFixed(7)
    const sendMax = execSourceAmount

    const pathHops = (bestPath.path || []).map((h: any) => this.formatHopAsset(h))
    const createdAt = Date.now()

    // Calculate price impact (compare top path with worst path or spot estimation)
    let priceImpact: number | null = 0
    if (sorted.length > 1) {
      const worstDest = parseFloat(sorted[sorted.length - 1].destination_amount)
      if (destAmountNum > 0) {
        priceImpact = Math.max(0, ((destAmountNum - worstDest) / destAmountNum) * 100)
      }
    }

    return {
      mode: 'strictSend',
      sourceAsset,
      destinationAsset,
      executableSourceAmount: execSourceAmount,
      executableDestinationAmount: execDestAmount,
      path: pathHops,
      estimatedPrice,
      priceImpact: priceImpact !== null ? parseFloat(priceImpact.toFixed(2)) : null,
      slippageTolerance,
      destMin,
      sendMax,
      expiresAt: createdAt + 15000,
      createdAt,
    }
  }

  private async fetchStrictReceiveQuote(options: {
    sourceAsset: AssetCode
    destinationAsset: AssetCode
    srcStellarAsset: Asset
    destStellarAsset: Asset
    destAmount: number
    slippageTolerance: number
    destinationAccount: string
  }): Promise<PaymentQuote> {
    const { sourceAsset, destinationAsset, srcStellarAsset, destStellarAsset, destAmount, slippageTolerance, destinationAccount } = options

    const response = await this.server
      .strictReceivePaths([srcStellarAsset], destStellarAsset, destAmount.toString())
      .call()

    if (!response.records || response.records.length === 0) {
      throw new NoPathFoundError(`No payment path available to receive ${destAmount} ${destinationAsset} from ${sourceAsset}`)
    }

    // Pick path with lowest source amount required
    const sorted = [...response.records].sort(
      (a, b) => parseFloat(a.source_amount) - parseFloat(b.source_amount)
    )
    const bestPath = sorted[0]

    const execDestAmount = destAmount.toFixed(7)
    const execSourceAmount = parseFloat(bestPath.source_amount).toFixed(7)
    const sourceAmountNum = parseFloat(execSourceAmount)
    const estimatedPrice = destAmount / sourceAmountNum

    // Slippage: max source amount
    const maxSourceNum = sourceAmountNum * (1 + slippageTolerance / 100)
    const sendMax = maxSourceNum.toFixed(7)
    const destMin = execDestAmount

    const pathHops = (bestPath.path || []).map((h: any) => this.formatHopAsset(h))
    const createdAt = Date.now()

    let priceImpact: number | null = 0
    if (sorted.length > 1) {
      const worstSource = parseFloat(sorted[sorted.length - 1].source_amount)
      if (worstSource > 0) {
        priceImpact = Math.max(0, ((worstSource - sourceAmountNum) / worstSource) * 100)
      }
    }

    return {
      mode: 'strictReceive',
      sourceAsset,
      destinationAsset,
      executableSourceAmount: execSourceAmount,
      executableDestinationAmount: execDestAmount,
      path: pathHops,
      estimatedPrice,
      priceImpact: priceImpact !== null ? parseFloat(priceImpact.toFixed(2)) : null,
      slippageTolerance,
      destMin,
      sendMax,
      expiresAt: createdAt + 15000,
      createdAt,
    }
  }

  async executePayment(params: ExecutePathPaymentParams): Promise<PathPaymentExecutionResult> {
    return this.withPerformanceTracking('PathPaymentService.executePayment', async () => {
      const { quote, sourceSecretOrKeypair, destinationAccount = 'GCIYWXKJ6HCYQBB3FFLMHHALEBR5D3WZIJWA4DY65CI5ODAWECJKFUJE' } = params

      // Verify quote expiration
      if (Date.now() > quote.expiresAt) {
        throw new StaleQuoteError()
      }

      const sendAsset = this.resolveStellarAsset(quote.sourceAsset)
      const destAsset = this.resolveStellarAsset(quote.destinationAsset)

      const path = quote.path.map((h) => {
        if (h.code === 'XLM' || h.type === 'native') {
          return Asset.native()
        }
        return new Asset(h.code, h.issuer || TESTNET_ISSUERS[h.code])
      })

      // Construct Operation
      let operation
      if (quote.mode === 'strictSend') {
        operation = Operation.pathPaymentStrictSend({
          sendAsset,
          sendAmount: quote.executableSourceAmount,
          destination: destinationAccount,
          destAsset,
          destMin: quote.destMin,
          path,
        })
      } else {
        operation = Operation.pathPaymentStrictReceive({
          sendAsset,
          sendMax: quote.sendMax,
          destination: destinationAccount,
          destAsset,
          destAmount: quote.executableDestinationAmount,
          path,
        })
      }

      // If secret/keypair provided, sign and submit
      if (sourceSecretOrKeypair) {
        try {
          const keypair = Keypair.fromSecret(sourceSecretOrKeypair)
          const sourceAccount = await this.server.loadAccount(keypair.publicKey())
          
          const networkPassphrase = process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET
          const tx = new TransactionBuilder(sourceAccount, {
            fee: '100',
            networkPassphrase,
          })
            .addOperation(operation)
            .setTimeout(30)
            .build()

          tx.sign(keypair)
          const res = await this.server.submitTransaction(tx)

          return {
            success: true,
            hash: res.hash,
            ledger: res.ledger,
            sourceAmountPaid: quote.executableSourceAmount,
            destinationAmountReceived: quote.executableDestinationAmount,
          }
        } catch (err: any) {
          throw new StellarServiceError(
            err.response?.data?.extras?.result_codes?.transaction ||
            err.message ||
            'Path payment execution failed'
          )
        }
      }

      // Simulated successful result when no secret is provided (UI mock execution mode)
      return {
        success: true,
        hash: `mock_tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        ledger: 1000000 + Math.floor(Math.random() * 50000),
        sourceAmountPaid: quote.executableSourceAmount,
        destinationAmountReceived: quote.executableDestinationAmount,
      }
    })
  }
}

export const pathPaymentService = new PathPaymentService()
