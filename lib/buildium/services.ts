// lib/buildium/services.ts - Business logic layer over the Buildium API client
import { getBuildiumClient } from './client';
import type {
  BuildiumTenant,
  BuildiumLease,
  BuildiumOutstandingBalance,
  BuildiumTransaction,
  BuildiumResidentRequest,
  BuildiumWorkOrder,
  BuildiumProperty,
  BuildiumUnit,
  BuildiumVendor,
  CreateResidentRequestPayload,
  CreateChargePayload,
  CreateWorkOrderPayload,
  CreateAnnouncementPayload,
} from './types';

const client = () => getBuildiumClient();

// ============================================
// TENANT LOOKUP (for identity verification)
// ============================================

export async function findTenantByEmail(email: string): Promise<BuildiumTenant | null> {
  try {
    const res = await client().get<BuildiumTenant[]>('/leases/tenants', {
      emails: email,
      limit: 5,
    });
    return res.data?.[0] || null;
  } catch {
    return null;
  }
}

export async function findTenantByPhone(phone: string): Promise<BuildiumTenant | null> {
  try {
    const digits = phone.replace(/\D/g, '');
    const res = await client().get<BuildiumTenant[]>('/leases/tenants', {
      phones: digits,
      limit: 5,
    });
    return res.data?.[0] || null;
  } catch {
    return null;
  }
}

export async function getTenantById(tenantId: number): Promise<BuildiumTenant> {
  const res = await client().get<BuildiumTenant>(`/leases/tenants/${tenantId}`);
  return res.data;
}

export async function searchTenants(params?: Record<string, any>): Promise<BuildiumTenant[]> {
  const res = await client().get<BuildiumTenant[]>('/leases/tenants', { ...params, limit: 50 });
  return res.data || [];
}

// ============================================
// LEASES
// ============================================

export async function getLeaseById(leaseId: number): Promise<BuildiumLease> {
  const res = await client().get<BuildiumLease>(`/leases/${leaseId}`);
  return res.data;
}

export async function getAllLeases(params?: Record<string, any>): Promise<BuildiumLease[]> {
  return client().listAll<BuildiumLease>('/leases', params);
}

// ============================================
// BALANCES & TRANSACTIONS
// ============================================

export async function getOutstandingBalance(leaseId: number): Promise<BuildiumOutstandingBalance | null> {
  try {
    const res = await client().get<BuildiumOutstandingBalance[]>('/leases/outstandingbalances', {
      leaseids: String(leaseId),
    });
    return res.data?.[0] || null;
  } catch {
    return null;
  }
}

export async function getAllOutstandingBalances(): Promise<BuildiumOutstandingBalance[]> {
  const res = await client().get<BuildiumOutstandingBalance[]>('/leases/outstandingbalances', {
    limit: 1000,
  });
  return res.data || [];
}

export async function getLeaseTransactions(leaseId: number, limit = 20): Promise<BuildiumTransaction[]> {
  const res = await client().get<BuildiumTransaction[]>(`/leases/${leaseId}/transactions`, {
    limit,
    orderby: 'Date desc',
  });
  return res.data || [];
}

// ============================================
// MAINTENANCE / RESIDENT REQUESTS
// ============================================

export async function getResidentRequests(params?: Record<string, any>): Promise<BuildiumResidentRequest[]> {
  const res = await client().get<BuildiumResidentRequest[]>('/tasks/residentrequests', {
    ...params,
    limit: params?.limit || 50,
  });
  return res.data || [];
}

export async function createResidentRequest(payload: CreateResidentRequestPayload): Promise<BuildiumResidentRequest> {
  const res = await client().post<BuildiumResidentRequest>('/tasks/residentrequests', payload);
  return res.data;
}

// ============================================
// WORK ORDERS
// ============================================

export async function getWorkOrders(params?: Record<string, any>): Promise<BuildiumWorkOrder[]> {
  const res = await client().get<BuildiumWorkOrder[]>('/workorders', {
    ...params,
    limit: params?.limit || 50,
  });
  return res.data || [];
}

export async function createWorkOrder(payload: CreateWorkOrderPayload): Promise<BuildiumWorkOrder> {
  const res = await client().post<BuildiumWorkOrder>('/workorders', payload);
  return res.data;
}

// ============================================
// PROPERTIES & UNITS
// ============================================

export async function getProperties(): Promise<BuildiumProperty[]> {
  return client().listAll<BuildiumProperty>('/rentals');
}

export async function getPropertyById(propertyId: number): Promise<BuildiumProperty> {
  const res = await client().get<BuildiumProperty>(`/rentals/${propertyId}`);
  return res.data;
}

export async function getUnits(propertyId?: number): Promise<BuildiumUnit[]> {
  const params = propertyId ? { propertyids: String(propertyId) } : {};
  return client().listAll<BuildiumUnit>('/rentals/units', params);
}

// ============================================
// CHARGES & PAYMENTS
// ============================================

export async function createCharge(leaseId: number, payload: CreateChargePayload) {
  const res = await client().post(`/leases/${leaseId}/charges`, payload);
  return res.data;
}

// ============================================
// VENDORS
// ============================================

export async function getVendors(): Promise<BuildiumVendor[]> {
  return client().listAll<BuildiumVendor>('/vendors');
}

// ============================================
// COMMUNICATIONS
// ============================================

export async function createAnnouncement(payload: CreateAnnouncementPayload) {
  const res = await client().post('/communications/announcements', payload);
  return res.data;
}

export async function sendEmail(payload: any) {
  const res = await client().post('/communications/emails', payload);
  return res.data;
}
