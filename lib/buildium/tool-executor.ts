// lib/buildium/tool-executor.ts - Dispatches OpenAI tool calls to Buildium services
import * as services from './services';
import { TenantVerificationOperations } from '../../db/operations';

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

// ============================================
// PUBLIC TOOL EXECUTOR (tenant-facing)
// ============================================

export async function executePublicTool(
  toolName: string,
  args: Record<string, any>,
  chatId: string,
): Promise<ToolResult> {
  try {
    // verify_tenant_identity is the only tool that works without prior verification
    if (toolName === 'verify_tenant_identity') {
      return handleVerifyIdentity(args, chatId);
    }

    // All other public tools require verification
    const verification = await TenantVerificationOperations.getByChatId(chatId);
    if (!verification?.buildiumTenantId || !verification?.buildiumLeaseId) {
      return {
        success: false,
        error: 'TENANT_NOT_VERIFIED. You must verify the tenant\'s identity first. Ask them for their email address or phone number, then call verify_tenant_identity.',
      };
    }

    const tenantId = Number(verification.buildiumTenantId);
    const leaseId = Number(verification.buildiumLeaseId);

    switch (toolName) {
      case 'get_my_balance':
        return handleGetMyBalance(leaseId);
      case 'get_my_transactions':
        return handleGetMyTransactions(leaseId, args);
      case 'get_my_lease_info':
        return handleGetMyLeaseInfo(leaseId);
      case 'submit_maintenance_request':
        return handleSubmitMaintenance(tenantId, leaseId, args);
      case 'get_my_maintenance_requests':
        return handleGetMyMaintenance(tenantId);
      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (err: any) {
    console.error(`Public tool error (${toolName}):`, err.message);
    return { success: false, error: err.response?.data?.message || err.message || 'An error occurred' };
  }
}

// ============================================
// INTERNAL TOOL EXECUTOR (staff-facing)
// ============================================

export async function executeInternalTool(
  toolName: string,
  args: Record<string, any>,
): Promise<ToolResult> {
  try {
    switch (toolName) {
      case 'search_tenants': {
        const params: Record<string, any> = {};
        if (args.name) params.name = args.name;
        if (args.email) params.emails = args.email;
        if (args.phone) params.phones = args.phone;
        if (args.leaseIds) params.leaseids = args.leaseIds;
        if (args.propertyIds) params.propertyids = args.propertyIds;
        const tenants = await services.searchTenants(params);
        return { success: true, data: tenants.map(t => ({
          id: t.Id,
          name: `${t.FirstName} ${t.LastName}`,
          email: t.Email,
          phone: t.PhoneNumbers?.[0]?.Number || null,
          leaseId: t.LeaseId,
          propertyId: t.PropertyId,
          unitId: t.UnitId,
        })) };
      }

      case 'get_tenant_details': {
        const tenant = await services.getTenantById(args.tenantId);
        return { success: true, data: {
          id: tenant.Id,
          name: `${tenant.FirstName} ${tenant.LastName}`,
          email: tenant.Email,
          alternateEmail: tenant.AlternateEmail,
          phones: tenant.PhoneNumbers?.map(p => `${p.Type}: ${p.Number}`) || [],
          leaseId: tenant.LeaseId,
          propertyId: tenant.PropertyId,
          unitId: tenant.UnitId,
          address: tenant.Address ? `${tenant.Address.AddressLine1}, ${tenant.Address.City}, ${tenant.Address.State} ${tenant.Address.PostalCode}` : null,
          dateOfBirth: tenant.DateOfBirth,
          createdDate: tenant.CreatedDateTime,
        } };
      }

      case 'get_outstanding_balances': {
        const balance = await services.getOutstandingBalance(args.leaseId);
        return { success: true, data: balance };
      }

      case 'get_all_outstanding_balances': {
        const balances = await services.getAllOutstandingBalances();
        return { success: true, data: balances };
      }

      case 'get_lease_transactions': {
        const txns = await services.getLeaseTransactions(args.leaseId, args.limit);
        return { success: true, data: txns.map(t => ({
          id: t.Id,
          date: t.Date,
          type: t.TransactionType,
          amount: t.TotalAmount,
          memo: t.Memo,
          paymentMethod: t.PaymentMethod,
        })) };
      }

      case 'get_lease_info': {
        const lease = await services.getLeaseById(args.leaseId);
        return { success: true, data: {
          id: lease.Id,
          unitNumber: lease.UnitNumber,
          leaseType: lease.LeaseType,
          startDate: lease.LeaseFromDate,
          endDate: lease.LeaseToDate,
          rentAmount: lease.Rent?.TotalAmount,
          securityDeposit: lease.SecurityDeposit,
          status: lease.Status,
          tenantIds: lease.TenantIds,
          propertyId: lease.PropertyId,
          moveInDate: lease.MoveInDate,
        } };
      }

      case 'list_all_leases': {
        const params: Record<string, any> = {};
        if (args.propertyIds) params.propertyids = args.propertyIds;
        if (args.statuses) params.statuses = args.statuses;
        const leases = await services.getAllLeases(params);
        const statusCounts: Record<string, number> = {};
        leases.forEach(l => { statusCounts[l.Status] = (statusCounts[l.Status] || 0) + 1; });
        return { success: true, data: {
          summary: { total: leases.length, byStatus: statusCounts },
          leases: leases.map(l => ({
            id: l.Id,
            unitNumber: l.UnitNumber,
            leaseType: l.LeaseType,
            startDate: l.LeaseFromDate,
            endDate: l.LeaseToDate,
            rentAmount: l.Rent?.TotalAmount,
            status: l.Status,
            tenantIds: l.TenantIds,
          })),
        } };
      }

      case 'list_properties': {
        const props = await services.getProperties();
        return { success: true, data: {
          summary: { total: props.length, active: props.filter(p => p.IsActive).length },
          properties: props.map(p => ({
            id: p.Id,
            name: p.Name,
            address: `${p.Address.AddressLine1}, ${p.Address.City}, ${p.Address.State} ${p.Address.PostalCode}`,
            numberOfUnits: p.NumberOfUnits,
            isActive: p.IsActive,
          })),
        } };
      }

      case 'list_units': {
        const units = await services.getUnits(args.propertyId);
        return { success: true, data: units.map(u => ({
          id: u.Id,
          unitNumber: u.UnitNumber,
          propertyId: u.PropertyId,
          marketRent: u.MarketRent,
          bedrooms: u.UnitBedrooms,
          bathrooms: u.UnitBathrooms,
          description: u.Description,
        })) };
      }

      case 'list_maintenance_requests': {
        const params: Record<string, any> = {};
        if (args.unitId) params.unitid = args.unitId;
        if (args.statuses) params.statuses = args.statuses;
        if (args.limit) params.limit = args.limit;
        const reqs = await services.getResidentRequests(params);
        const statusCounts: Record<string, number> = {};
        reqs.forEach(r => { statusCounts[r.TaskStatus] = (statusCounts[r.TaskStatus] || 0) + 1; });
        return { success: true, data: {
          summary: { total: reqs.length, byStatus: statusCounts },
          requests: reqs.map(r => ({
            id: r.Id,
            title: r.Title,
            status: r.TaskStatus,
            priority: r.Priority,
            createdDate: r.CreatedDateTime,
            dueDate: r.DueDate,
            description: r.Description,
          })),
        } };
      }

      case 'create_maintenance_request': {
        const result = await services.createResidentRequest({
          UnitAgreementId: args.unitAgreementId,
          RequestedByEntityId: args.tenantId,
          Title: args.title,
          Description: args.description,
          Priority: args.priority || 'Normal',
          TaskStatus: 'New',
        });
        return { success: true, data: {
          id: result.Id,
          title: result.Title,
          status: result.TaskStatus,
          priority: result.Priority,
          message: 'Maintenance request created successfully.',
        } };
      }

      case 'create_work_order': {
        const result = await services.createWorkOrder({
          VendorId: args.vendorId,
          EntryAllowed: 'Unknown',
          WorkDetails: args.description,
          Task: {
            Title: args.title,
            Description: args.description,
            Priority: args.priority || 'Normal',
            TaskStatus: 'New',
            DueDate: args.dueDate,
            PropertyId: args.propertyId,
            UnitId: args.unitId,
          },
        });
        return { success: true, data: {
          id: result.Id,
          title: result.Task?.Title,
          status: result.Task?.TaskStatus,
          vendorId: result.VendorId,
          message: 'Work order created successfully.',
        } };
      }

      case 'create_charge': {
        const result = await services.createCharge(args.leaseId, {
          Date: args.date || new Date().toISOString().slice(0, 10),
          Memo: args.memo,
          Lines: [{ Amount: args.amount, GLAccountId: args.glAccountId || 0 }],
        });
        return { success: true, data: {
          id: result.Id,
          date: result.Date,
          amount: args.amount,
          memo: args.memo,
          message: 'Charge created successfully.',
        } };
      }

      case 'list_work_orders': {
        const params: Record<string, any> = {};
        if (args.statuses) params.statuses = args.statuses;
        if (args.limit) params.limit = args.limit;
        const orders = await services.getWorkOrders(params);
        const statusCounts: Record<string, number> = {};
        orders.forEach(o => { const s = o.Task?.TaskStatus || 'Unknown'; statusCounts[s] = (statusCounts[s] || 0) + 1; });
        return { success: true, data: {
          summary: { total: orders.length, byStatus: statusCounts },
          workOrders: orders.map(o => ({
            id: o.Id,
            title: o.Task?.Title,
            status: o.Task?.TaskStatus,
            priority: o.Task?.Priority,
            dueDate: o.Task?.DueDate,
            vendorId: o.VendorId,
            workDetails: o.WorkDetails,
            createdDate: o.CreatedDateTime,
          })),
        } };
      }

      case 'list_vendors': {
        const vendors = await services.getVendors();
        return { success: true, data: vendors.map(v => ({
          id: v.Id,
          name: v.IsCompany ? v.CompanyName : `${v.FirstName} ${v.LastName}`,
          email: v.PrimaryEmail,
          phone: v.PhoneNumbers?.[0]?.Number || null,
          isActive: v.IsActive,
        })) };
      }

      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (err: any) {
    console.error(`Internal tool error (${toolName}):`, err.message);
    return { success: false, error: err.response?.data?.message || err.message || 'Buildium API error' };
  }
}

// ============================================
// PUBLIC TOOL HANDLERS
// ============================================

async function handleVerifyIdentity(
  args: Record<string, any>,
  chatId: string,
): Promise<ToolResult> {
  if (!args.email && !args.phone) {
    return { success: false, error: 'Please provide either an email or phone number to verify.' };
  }

  let tenant = null;
  if (args.email) {
    tenant = await services.findTenantByEmail(args.email);
  }
  if (!tenant && args.phone) {
    tenant = await services.findTenantByPhone(args.phone);
  }

  if (!tenant) {
    return {
      success: false,
      error: 'No tenant found with that email or phone number. Please double-check the information or contact the office directly.',
    };
  }

  // Store verification in database
  await TenantVerificationOperations.create({
    chatId,
    buildiumTenantId: String(tenant.Id),
    buildiumLeaseId: String(tenant.LeaseId),
    verifiedEmail: args.email || null,
    verifiedPhone: args.phone || null,
  });

  return {
    success: true,
    data: {
      tenantName: `${tenant.FirstName} ${tenant.LastName}`,
      verified: true,
    },
  };
}

async function handleGetMyBalance(leaseId: number): Promise<ToolResult> {
  const balance = await services.getOutstandingBalance(leaseId);
  if (!balance) {
    return { success: true, data: { totalBalance: 0, message: 'No outstanding balance found.' } };
  }
  return { success: true, data: {
    totalBalance: balance.TotalBalance,
    depositBalance: balance.BalanceDetails?.DepositBalance,
    prepayBalance: balance.BalanceDetails?.PrepayBalance,
    chargeBalance: balance.BalanceDetails?.ChargeBalance,
  } };
}

async function handleGetMyTransactions(leaseId: number, args: Record<string, any>): Promise<ToolResult> {
  const txns = await services.getLeaseTransactions(leaseId, args.limit || 10);
  return { success: true, data: txns.map(t => ({
    date: t.Date,
    type: t.TransactionType,
    amount: t.TotalAmount,
    memo: t.Memo,
    paymentMethod: t.PaymentMethod,
  })) };
}

async function handleGetMyLeaseInfo(leaseId: number): Promise<ToolResult> {
  const lease = await services.getLeaseById(leaseId);
  return {
    success: true,
    data: {
      leaseType: lease.LeaseType,
      startDate: lease.LeaseFromDate,
      endDate: lease.LeaseToDate,
      unitNumber: lease.UnitNumber,
      rentAmount: lease.Rent?.TotalAmount,
      status: lease.Status,
    },
  };
}

async function handleSubmitMaintenance(
  tenantId: number,
  leaseId: number,
  args: Record<string, any>,
): Promise<ToolResult> {
  const result = await services.createResidentRequest({
    UnitAgreementId: leaseId,
    RequestedByEntityId: tenantId,
    Title: args.title,
    Description: args.description,
    Priority: args.priority || 'Normal',
    TaskStatus: 'New',
  });
  return {
    success: true,
    data: {
      requestId: result.Id,
      title: result.Title,
      status: result.TaskStatus,
      message: 'Your maintenance request has been submitted. Our team will review it shortly.',
    },
  };
}

async function handleGetMyMaintenance(tenantId: number): Promise<ToolResult> {
  const reqs = await services.getResidentRequests({
    requestedbyentityid: tenantId,
  });
  return {
    success: true,
    data: reqs.map(r => ({
      id: r.Id,
      title: r.Title,
      status: r.TaskStatus,
      priority: r.Priority,
      createdDate: r.CreatedDateTime,
      description: r.Description,
    })),
  };
}
