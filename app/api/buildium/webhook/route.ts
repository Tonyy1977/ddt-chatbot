// app/api/buildium/webhook/route.ts - Receives webhook events from Buildium
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { WebhookEventOperations } from '@/db/operations';

function verifySignature(payload: string, signature: string, secret: string): boolean {
  if (!signature) return false;
  try {
    const computed = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(computed, 'hex'),
      Buffer.from(signature, 'hex'),
    );
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const secret = process.env.BUILDIUM_WEBHOOK_SECRET;
  if (!secret) {
    console.error('BUILDIUM_WEBHOOK_SECRET not configured');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get('x-buildium-signature') || '';
  const timestamp = request.headers.get('x-buildium-timestamp') || '';

  // Validate signature (Buildium signs timestamp + body)
  const signPayload = timestamp ? timestamp + rawBody : rawBody;
  if (!verifySignature(signPayload, signature, secret)) {
    console.warn('Webhook signature verification failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Store event for idempotency and audit
  const eventType = event.EventType || event.type || 'unknown';
  const resourceId = String(event.ResourceId || event.Id || '');

  try {
    const stored = await WebhookEventOperations.create({
      eventType,
      resourceId,
      payload: event,
    });

    // Process the event (within 10 second Buildium timeout)
    await processEvent(eventType, event, stored.id);
  } catch (err: any) {
    console.error('Webhook processing error:', err.message);
    // Still return 200 to acknowledge receipt and prevent retries
  }

  return NextResponse.json({ received: true });
}

async function processEvent(eventType: string, event: any, eventId: string) {
  switch (eventType) {
    case 'MaintenanceRequest.Created':
      console.log(`[Webhook] New maintenance request: ${event.ResourceId}`);
      // Future: notify staff via dashboard, send confirmation to tenant
      break;

    case 'MaintenanceRequest.Updated':
      console.log(`[Webhook] Maintenance request updated: ${event.ResourceId}`);
      // Future: notify tenant of status change
      break;

    case 'Payment.Received':
      console.log(`[Webhook] Payment received: ${event.ResourceId}`);
      // Future: send thank-you notification to tenant
      break;

    case 'Tenant.Created':
      console.log(`[Webhook] New tenant created: ${event.ResourceId}`);
      // Future: send welcome message
      break;

    case 'Lease.Created':
      console.log(`[Webhook] New lease created: ${event.ResourceId}`);
      break;

    default:
      console.log(`[Webhook] Unhandled event: ${eventType}`, event.ResourceId);
  }

  await WebhookEventOperations.markProcessed(eventId);
}
