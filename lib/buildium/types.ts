// lib/buildium/types.ts - Buildium API type definitions

// ============================================
// RESPONSE TYPES (from Buildium GET endpoints)
// ============================================

export interface BuildiumAddress {
  AddressLine1: string;
  AddressLine2: string | null;
  AddressLine3: string | null;
  City: string;
  State: string;
  PostalCode: string;
  Country: string;
}

export interface BuildiumPhoneNumber {
  Type: string;
  Number: string;
}

export interface BuildiumTenant {
  Id: number;
  FirstName: string;
  LastName: string;
  Email: string;
  AlternateEmail: string | null;
  PhoneNumbers: BuildiumPhoneNumber[];
  LeaseId: number;
  UnitId: number;
  PropertyId: number;
  DateOfBirth: string | null;
  MailingPreference: string | null;
  Address: BuildiumAddress;
  AlternateAddress: BuildiumAddress | null;
  EmergencyContact: {
    FirstName: string;
    LastName: string;
    Phone: string;
  } | null;
  CreatedDateTime: string;
  Comment: string | null;
}

export interface BuildiumLease {
  Id: number;
  TenantIds: number[];
  PropertyId: number;
  UnitId: number;
  UnitNumber: string;
  LeaseType: string; // AtWill, Fixed, FixedWithRollover
  LeaseFromDate: string;
  LeaseToDate: string | null;
  Rent: {
    TotalAmount: number;
    Charges: { Amount: number; GLAccountId: number; Memo: string }[];
  } | null;
  SecurityDeposit: number | null;
  Status: string;
  CreatedDateTime: string;
  MoveInDate: string | null;
}

export interface BuildiumOutstandingBalance {
  LeaseId: number;
  TotalBalance: number;
  BalanceDetails: {
    DepositBalance: number;
    PrepayBalance: number;
    ChargeBalance: number;
  } | null;
}

export interface BuildiumTransaction {
  Id: number;
  Date: string;
  TransactionType: string;
  TotalAmount: number;
  CheckNumber: string | null;
  Memo: string;
  PaymentMethod: string | null;
  Journal: {
    Lines: {
      GLAccount: { Id: number; Name: string };
      Amount: number;
    }[];
  } | null;
}

export interface BuildiumResidentRequest {
  Id: number;
  Title: string;
  Description: string;
  TaskStatus: string;
  Priority: string;
  UnitAgreementId: number;
  RequestedByEntityId: number;
  AssignedToUserId: number | null;
  DueDate: string | null;
  CategoryId: number | null;
  CreatedDateTime: string;
  UpdatedDateTime: string;
  IsEntryPermittedByResident: boolean;
  DoesResidentHavePets: boolean;
  ResidentEntryNotes: string | null;
}

export interface BuildiumWorkOrder {
  Id: number;
  Task: {
    Id: number;
    Title: string;
    Description: string;
    TaskStatus: string;
    Priority: string;
    DueDate: string | null;
    CategoryId: number | null;
    AssignedToUserId: number | null;
  };
  VendorId: number;
  WorkDetails: string;
  InvoiceNumber: string | null;
  EntryAllowed: string;
  EntryNotes: string | null;
  VendorNotes: string | null;
  LineItems: {
    Description: string;
    Amount: number;
  }[];
  CreatedDateTime: string;
}

export interface BuildiumProperty {
  Id: number;
  Name: string;
  StructureDescription: string | null;
  Address: BuildiumAddress;
  NumberOfUnits: number;
  OperatingBankAccountId: number;
  PropertyManagerId: number | null;
  Reserve: number | null;
  YearBuilt: number | null;
  IsActive: boolean;
}

export interface BuildiumUnit {
  Id: number;
  PropertyId: number;
  UnitNumber: string;
  Description: string | null;
  MarketRent: number | null;
  UnitSize: number | null;
  Address: BuildiumAddress;
  UnitBedrooms: string | null;
  UnitBathrooms: string | null;
}

export interface BuildiumVendor {
  Id: number;
  IsCompany: boolean;
  FirstName: string | null;
  LastName: string | null;
  CompanyName: string | null;
  PrimaryEmail: string | null;
  PhoneNumbers: BuildiumPhoneNumber[];
  Address: BuildiumAddress | null;
  CategoryId: number;
  Website: string | null;
  IsActive: boolean;
}

// ============================================
// REQUEST PAYLOAD TYPES (for POST/PUT endpoints)
// ============================================

export interface CreateResidentRequestPayload {
  Title: string;
  Description: string;
  UnitAgreementId: number;
  RequestedByEntityId: number;
  TaskStatus: 'New';
  Priority: 'Low' | 'Normal' | 'High';
  CategoryId?: number;
  SubCategoryId?: number;
  AssignedToUserId?: number;
  DueDate?: string;
  IsEntryPermittedByResident?: boolean;
  DoesResidentHavePets?: boolean;
  ResidentEntryNotes?: string;
  ShareWithRentalOwners?: boolean;
}

export interface CreateChargePayload {
  Date: string; // YYYY-MM-DD
  Memo: string;
  Lines: {
    Amount: number;
    GLAccountId: number;
  }[];
}

export interface CreateWorkOrderPayload {
  VendorId: number;
  EntryAllowed: 'Unknown' | 'Yes' | 'No';
  WorkDetails?: string;
  InvoiceNumber?: string;
  EntryNotes?: string;
  VendorNotes?: string;
  LineItems?: {
    Description: string;
    Amount: number;
    GLAccountId: number;
  }[];
  TaskId?: number;
  Task?: {
    Title: string;
    Description?: string;
    Priority: 'Low' | 'Normal' | 'High';
    TaskStatus: 'New' | 'InProgress' | 'Completed' | 'Deferred';
    DueDate?: string;
    CategoryId?: number;
    PropertyId?: number;
    UnitId?: number;
    AssignedToUserId?: number;
  };
}

export interface CreateEmailPayload {
  TemplateId: number;
  Subject: string;
  Body?: string;
  IncludeAlternateEmails?: boolean;
  PropertyIds?: number[];
  RecipientIds?: { Type: string; Id: number }[];
}

export interface CreateAnnouncementPayload {
  Subject: string;
  Body: string;
  PropertyIds: number[];
  ExpirationDate?: string;
  NotifyAssociationTenants?: boolean;
  IncludeAlternateEmail?: boolean;
}
