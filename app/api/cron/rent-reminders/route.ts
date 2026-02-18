// app/api/cron/rent-reminders/route.ts - Monthly rent reminder cron job
// Schedule: 25th of each month at 9 AM (configured in vercel.json)
import { NextRequest, NextResponse } from 'next/server';
import * as services from '@/lib/buildium/services';

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends this automatically for cron jobs)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get all active leases
    const leases = await services.getAllLeases({ statuses: 'Active' });
    let reminderCount = 0;
    const errors: string[] = [];

    for (const lease of leases) {
      try {
        // Check if there's an outstanding balance
        const balance = await services.getOutstandingBalance(lease.Id);
        if (!balance || balance.TotalBalance <= 0) continue;

        // Get tenant info for logging
        const tenantIds = lease.TenantIds || [];
        if (tenantIds.length === 0) continue;

        // Log reminder (future: send via Buildium communications API or email service)
        console.log(
          `[Rent Reminder] Lease ${lease.Id}: Balance $${balance.TotalBalance}, ` +
          `Tenants: ${tenantIds.join(', ')}, Unit: ${lease.UnitNumber}`
        );

        reminderCount++;
      } catch (err: any) {
        errors.push(`Lease ${lease.Id}: ${err.message}`);
      }
    }

    return NextResponse.json({
      message: `Processed ${leases.length} leases, ${reminderCount} reminders queued`,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    console.error('Rent reminders cron error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
