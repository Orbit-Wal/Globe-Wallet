"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useTrustlines, RESERVE_PER_TRUSTLINE } from "@/hooks/useTrustlines"
import { SUPPORTED_STELLAR_ASSETS } from "@/lib/fixtures/assets"
import { AssetCode } from "@/lib/types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Info, AlertCircle, Loader2 } from "lucide-react"

export function TrustlineManager({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{ asset: AssetCode, action: 'add' | 'remove' } | null>(null)
  
  const { trustlines, loading, isProcessing, changeTrustline, hasTrustline } = useTrustlines()

  const handleAction = async () => {
    if (!confirmAction) return
    const success = await changeTrustline(confirmAction.asset, confirmAction.action)
    if (success) {
      setConfirmAction(null)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Issue #86: block dismissal while a trustline change is in flight.
        // The Cancel/Confirm buttons already disable themselves during
        // isProcessing, but nothing stopped Escape or an outside click from
        // closing the dialog mid-mutation — the async call keeps running
        // (this component just stays mounted, invisible), but the user
        // loses all visibility into whether it succeeded or failed.
        if (isProcessing) return
        setOpen(next)
      }}
    >
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-[425px]"
        onEscapeKeyDown={(e) => {
          if (isProcessing) e.preventDefault()
        }}
        onPointerDownOutside={(e) => {
          if (isProcessing) e.preventDefault()
        }}
        onInteractOutside={(e) => {
          if (isProcessing) e.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>Manage Trustlines</DialogTitle>
          <DialogDescription>
            Enable or disable assets for your Stellar wallet.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : confirmAction ? (
          <div className="space-y-4" data-testid="trustline-confirmation">
            <Alert variant={confirmAction.action === 'add' ? 'default' : 'destructive'}>
              {confirmAction.action === 'add' ? <Info className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              <AlertTitle>
                {confirmAction.action === 'add' ? 'Add Trustline' : 'Remove Trustline'}
              </AlertTitle>
              <AlertDescription>
                {confirmAction.action === 'add' ? (
                  <>
                    Adding a trustline for <strong>{confirmAction.asset}</strong> will reserve <strong>{RESERVE_PER_TRUSTLINE} XLM</strong> from your account balance.
                  </>
                ) : (
                  <>
                    Are you sure you want to remove the trustline for <strong>{confirmAction.asset}</strong>? This will free up <strong>{RESERVE_PER_TRUSTLINE} XLM</strong>. You can only remove trustlines with a zero balance.
                  </>
                )}
              </AlertDescription>
            </Alert>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmAction(null)} disabled={isProcessing}>
                Cancel
              </Button>
              <Button 
                variant={confirmAction.action === 'add' ? 'default' : 'destructive'} 
                onClick={handleAction} 
                disabled={isProcessing}
                data-testid={`confirm-${confirmAction.action}-trustline`}
              >
                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4" data-testid="trustline-list">
            <div className="grid gap-3">
              {SUPPORTED_STELLAR_ASSETS.map((asset) => {
                const isNative = asset.code === 'XLM'
                const isTrusted = isNative || hasTrustline(asset.code as AssetCode)

                return (
                  <div key={asset.code} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-semibold">{asset.code}</p>
                      <p className="text-xs text-muted-foreground">{asset.name}</p>
                    </div>
                    <div>
                      {isNative ? (
                        <span className="text-xs font-medium text-muted-foreground px-2 py-1 bg-secondary rounded-md">
                          Native (Required)
                        </span>
                      ) : isTrusted ? (
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => setConfirmAction({ asset: asset.code as AssetCode, action: 'remove' })}
                          data-testid={`remove-trustline-${asset.code}`}
                        >
                          Remove
                        </Button>
                      ) : (
                        <Button 
                          variant="secondary" 
                          size="sm"
                          onClick={() => setConfirmAction({ asset: asset.code as AssetCode, action: 'add' })}
                          data-testid={`add-trustline-${asset.code}`}
                        >
                          Add
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
