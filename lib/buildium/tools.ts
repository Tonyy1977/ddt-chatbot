// lib/buildium/tools.ts - OpenAI function-calling tool definitions for Buildium

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

// ============================================
// PUBLIC TOOLS (tenant-facing, require verification)
// ============================================

export const PUBLIC_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'verify_tenant_identity',
      description: 'Verify a tenant identity by their email address or phone number. This MUST be called before any other Buildium tool. Returns tenant name and verification status if found.',
      parameters: {
        type: 'object',
        properties: {
          email: { type: 'string', description: 'Tenant email address' },
          phone: { type: 'string', description: 'Tenant phone number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_balance',
      description: 'Get the outstanding rent balance for the verified tenant. Tenant must be verified first via verify_tenant_identity.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_transactions',
      description: 'Get recent payment and charge history for the verified tenant.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of recent transactions to return (default 10)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_lease_info',
      description: 'Get lease details (start date, end date, rent amount, unit number) for the verified tenant.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'submit_maintenance_request',
      description: 'Submit a maintenance request for the verified tenant. Creates a new request in the property management system.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short title describing the issue (e.g. "Leaking kitchen faucet")' },
          description: { type: 'string', description: 'Detailed description of the maintenance issue' },
          priority: { type: 'string', enum: ['Low', 'Normal', 'High'], description: 'Priority level (default Normal)' },
        },
        required: ['title', 'description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_maintenance_requests',
      description: 'Get all maintenance requests submitted by the verified tenant and their current status.',
      parameters: { type: 'object', properties: {} },
    },
  },
];

// ============================================
// INTERNAL TOOLS (staff-facing, full Buildium access)
// ============================================

export const INTERNAL_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'search_tenants',
      description: 'Search for tenants by name, email, phone, or filter by lease/property IDs.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Tenant name to search for' },
          email: { type: 'string', description: 'Tenant email to search for' },
          phone: { type: 'string', description: 'Tenant phone to search for' },
          leaseIds: { type: 'string', description: 'Comma-separated lease IDs to filter by' },
          propertyIds: { type: 'string', description: 'Comma-separated property IDs to filter by' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_tenant_details',
      description: 'Get detailed information about a specific tenant by their Buildium ID.',
      parameters: {
        type: 'object',
        properties: {
          tenantId: { type: 'number', description: 'Buildium tenant ID' },
        },
        required: ['tenantId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_outstanding_balances',
      description: 'Get the outstanding balance for a specific lease, showing how much is owed.',
      parameters: {
        type: 'object',
        properties: {
          leaseId: { type: 'number', description: 'Buildium lease ID' },
        },
        required: ['leaseId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_all_outstanding_balances',
      description: 'Get outstanding balances across all leases. Useful for finding who owes money.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_lease_transactions',
      description: 'Get transaction history (payments, charges) for a specific lease.',
      parameters: {
        type: 'object',
        properties: {
          leaseId: { type: 'number', description: 'Buildium lease ID' },
          limit: { type: 'number', description: 'Number of transactions to return (default 20)' },
        },
        required: ['leaseId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_lease_info',
      description: 'Get details about a specific lease (dates, rent, tenants, unit).',
      parameters: {
        type: 'object',
        properties: {
          leaseId: { type: 'number', description: 'Buildium lease ID' },
        },
        required: ['leaseId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_all_leases',
      description: 'List all leases, optionally filtered by property or status.',
      parameters: {
        type: 'object',
        properties: {
          propertyIds: { type: 'string', description: 'Comma-separated property IDs to filter' },
          statuses: { type: 'string', description: 'Comma-separated statuses: Active, Past, Future' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_properties',
      description: 'List all managed rental properties with their addresses and unit counts.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_units',
      description: 'List units, optionally filtered by property.',
      parameters: {
        type: 'object',
        properties: {
          propertyId: { type: 'number', description: 'Property ID to filter units by' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_maintenance_requests',
      description: 'List maintenance/resident requests with optional filters.',
      parameters: {
        type: 'object',
        properties: {
          unitId: { type: 'number', description: 'Filter by unit ID' },
          statuses: { type: 'string', description: 'Comma-separated statuses to filter by' },
          limit: { type: 'number', description: 'Max results (default 50)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_maintenance_request',
      description: 'Create a maintenance request on behalf of a tenant.',
      parameters: {
        type: 'object',
        properties: {
          unitAgreementId: { type: 'number', description: 'Unit agreement (lease) ID' },
          tenantId: { type: 'number', description: 'Requesting tenant ID' },
          title: { type: 'string', description: 'Issue title' },
          description: { type: 'string', description: 'Issue description' },
          priority: { type: 'string', enum: ['Low', 'Normal', 'High'], description: 'Priority level' },
        },
        required: ['unitAgreementId', 'tenantId', 'title', 'description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_work_order',
      description: 'Create a work order and assign it to a vendor.',
      parameters: {
        type: 'object',
        properties: {
          vendorId: { type: 'number', description: 'Vendor ID to assign the work to' },
          title: { type: 'string', description: 'Work order title' },
          description: { type: 'string', description: 'Work details' },
          priority: { type: 'string', enum: ['Low', 'Normal', 'High'], description: 'Priority level' },
          propertyId: { type: 'number', description: 'Property ID' },
          unitId: { type: 'number', description: 'Unit ID (optional)' },
          dueDate: { type: 'string', description: 'Due date in YYYY-MM-DD format' },
        },
        required: ['vendorId', 'title', 'description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_charge',
      description: 'Create a charge on a lease (e.g. late fee, utility charge).',
      parameters: {
        type: 'object',
        properties: {
          leaseId: { type: 'number', description: 'Lease ID to charge' },
          amount: { type: 'number', description: 'Charge amount in dollars' },
          memo: { type: 'string', description: 'Description of the charge (e.g. "Late fee - March 2025")' },
          date: { type: 'string', description: 'Charge date in YYYY-MM-DD format (default today)' },
          glAccountId: { type: 'number', description: 'GL Account ID for the charge' },
        },
        required: ['leaseId', 'amount', 'memo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_work_orders',
      description: 'List work orders with optional filters.',
      parameters: {
        type: 'object',
        properties: {
          statuses: { type: 'string', description: 'Comma-separated statuses to filter' },
          limit: { type: 'number', description: 'Max results (default 50)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_vendors',
      description: 'List all vendors (handymen, contractors, etc.).',
      parameters: { type: 'object', properties: {} },
    },
  },
];
