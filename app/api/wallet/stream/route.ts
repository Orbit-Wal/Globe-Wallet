import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db/mock-db';
import { validateBearerToken } from '@/lib/auth';
import type { Transaction } from '../../../../lib/types';

export const runtime = 'edge';

export async function GET(req: Request) {
  const request = new NextRequest(req.url, { headers: req.headers })
  if (!validateBearerToken(request)) {
    return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const txs = await db.getTransactions();
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(txs)}\n\n`));
      const unsubscribe = db.subscribeToTransactions((tx) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify([tx])}\n\n`));
      });
      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(':\n\n'));
      }, 15000);
      req.signal.addEventListener('abort', () => {
        clearInterval(keepAlive);
        unsubscribe();
        controller.close();
      });
    },
    cancel() {}
  });
  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
