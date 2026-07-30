'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { useAssets } from '../../hooks/useFinanceServices'
import { useErrorBoundary } from '../../hooks/useErrorBoundary'
import { AssetCode } from '../../lib/types'
import { ArrowUpDown, Calculator } from 'lucide-react'
import { Alert, AlertDescription } from '../ui/alert'
import { useTranslations } from 'next-intl'

interface CryptoConverterProps {
  className?: string
}

export function CryptoConverter({ className }: CryptoConverterProps) {
  const t = useTranslations()
  const { convert, format } = useAssets()
  const { hasError, error, withErrorBoundary } = useErrorBoundary()
  
  const ASSET_OPTIONS: { value: AssetCode; label: string }[] = [
    { value: 'XLM', label: t('common.stellarLumens') },
    { value: 'USDC', label: t('common.usdCoin') },
    { value: 'USDT', label: t('common.tetherUsd') }
  ]
  
  const [fromAsset, setFromAsset] = useState<AssetCode>('XLM')
  const [toAsset, setToAsset] = useState<AssetCode>('USDC')
  const [amount, setAmount] = useState<string>('')
  const [result, setResult] = useState<number | null>(null)
  const [calculating, setCalculating] = useState(false)

  const handleConvert = async () => {
    if (!amount || isNaN(Number(amount))) return
    
    setCalculating(true)
    try {
      const converted = await withErrorBoundary(() => 
        convert(fromAsset, toAsset, Number(amount))
      )
      setResult(converted)
    } catch (err) {
      console.error('Conversion failed:', err)
    } finally {
      setCalculating(false)
    }
  }

  const swapAssets = () => {
    const temp = fromAsset
    setFromAsset(toAsset)
    setToAsset(temp)
    setResult(null)
  }

  const handleAmountChange = (value: string) => {
    setAmount(value)
    setResult(null)
  }

  return (
    <Card className={className} data-testid="crypto-converter">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Calculator className="w-5 h-5" />
          <span>{t('common.cryptoConverter')}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasError && (
          <Alert variant="destructive" data-testid="converter-error">
            <AlertDescription>
              {error?.message || t('common.conversionFailed')}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          {/* From Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('common.fromLabel')}</label>
            <div className="flex space-x-2">
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="flex-1"
                data-testid="amount-input"
                min="0"
                step="0.01"
              />
              <Select value={fromAsset} onValueChange={(value) => setFromAsset(value as AssetCode)}>
                <SelectTrigger className="w-48" data-testid="from-asset-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_OPTIONS.map((asset) => (
                    <SelectItem key={asset.value} value={asset.value}>
                      {asset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Swap Button */}
          <div className="flex justify-center">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={swapAssets}
              data-testid="swap-button"
              aria-label={t('common.swap')}
            >
              <ArrowUpDown className="w-4 h-4" />
            </Button>
          </div>

          {/* To Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('common.toLabel')}</label>
            <div className="flex space-x-2">
              <Input
                type="text"
                placeholder="0.00"
                value={result ? format(result, toAsset) : ''}
                readOnly
                className="flex-1 bg-muted"
                data-testid="result-input"
              />
              <Select value={toAsset} onValueChange={(value) => setToAsset(value as AssetCode)}>
                <SelectTrigger className="w-48" data-testid="to-asset-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_OPTIONS.map((asset) => (
                    <SelectItem key={asset.value} value={asset.value}>
                      {asset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Convert Button */}
          <Button
            onClick={handleConvert}
            disabled={!amount || calculating || fromAsset === toAsset}
            className="w-full"
            data-testid="convert-button"
          >
            {calculating ? t('common.converting') : t('common.convertNow')}
          </Button>

          {/* Result Display */}
          {result !== null && (
            <div className="p-3 bg-muted rounded-lg" data-testid="conversion-result">
              <div className="text-sm text-muted-foreground">{t('common.conversionResult')}</div>
              <div className="text-lg font-semibold">
                {format(Number(amount), fromAsset)} = {format(result, toAsset)}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}