// app/api/cron/late-notices/route.ts - Monthly late payment notice cron job
// Schedule: 5th of each month at 9 AM (configured in vercel.json)
import { NextRequest, NextResponse } from 'next/server';
import * as services from '@/lib/buildium/services';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get all outstanding balances across the portfolio
    const balances = await services.getAllOutstandingBalances();
    let lateCount = 0;
    const errors: string[] = [];

    for (const balance of balances) {
      if (balance.TotalBalance <= 0) continue;

      try {
        // Get lease details for context
        const lease = await services.getLeaseById(balance.LeaseId);
        const tenantIds = lease.TenantIds || [];
        if (tenantIds.length === 0) continue;

        // Log late notice (future: send formal late notice via Buildium or email service)
        console.log(
          `[Late Notice] Lease ${lease.Id}: Overdue $${balance.TotalBalance}, ` +
          `Tenants: ${tenantIds.join(', ')}, Unit: ${lease.UnitNumber}`
        );

        lateCount++;
      } catch (err: any) {
        errors.push(`Lease ${balance.LeaseId}: ${err.message}`);
      }
    }

    return NextResponse.json({
      message: `Found ${lateCount} overdue leases out of ${balances.length} total`,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    console.error('Late notices cron error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
