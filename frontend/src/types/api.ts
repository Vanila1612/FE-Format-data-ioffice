export type ApiSuccess<T> = { success: true; data: T };
export type ApiFailure = { success: false; error: { code: string; message: string; details?: unknown } };
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type User = {
  id: string;
  username: string;
  displayName: string;
  role: 'ADMIN' | 'USER';
  createdAt?: string;
  updatedAt?: string;
};

export type ImportRecord = {
  id: string;
  originalFileName: string;
  status: 'UPLOADED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  totalRows: number;
  successRows: number;
  failedRows: number;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
  uploadedBy?: User;
  _count?: { documents: number; snapshots: number };
};

export type DocumentGroup = 'REPORT_PROPOSAL' | 'LETTER_AUTHORIZATION' | 'WORK_LETTER';

export type DocumentRecord = {
  id: string;
  summary: string;
  referenceNumber: string;
  signedDocument: string;
  signerName?: string;
  issueDate?: string;
  issuingUnit: string;
  normalizedUnit: string;
  documentGroup: DocumentGroup;
};

export type Paged<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type Summary = {
  totals: { total: number; signed: number; unsigned: number; signRate: number };
  byGroup: { key: DocumentGroup; label: string; total: number }[];
  byUnit: { unit: string; total: number; signed: number; unsigned: number; signRate: number }[];
  boardRows: ResultBoardRow[];
  signerBoardRows?: SignerBoardRow[];
};

export type SignerBoardRow = {
  stt: number;
  signer: string;
  totalDocuments: number;
  signed: number;
  signRate: number;
};

export type ResultBoardRow = {
  stt: number;
  unit: string;
  reportSigned: number; reportTotal: number; reportRate: number;
  letterSigned: number; letterTotal: number; letterRate: number;
  workSigned: number; workTotal: number; workRate: number;
  totalSigned: number; totalDocuments: number; totalRate: number;
};

export type ClassificationRule = {
  id: string;
  name: string;
  keyword: string;
  documentGroup: DocumentGroup;
  priority: number;
  enabled: boolean;
};

export type UnitMapping = {
  id: string;
  sourceName: string;
  normalizedName: string;
  enabled: boolean;
};

export type Signer = {
  id: string;
  username: string;
  fullName: string;
  position: string;
};

export type Snapshot = {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  import?: ImportRecord;
  ruleVersion: { version: number };
  mappingVersion: number;
  filtersJson?: { from?: string; to?: string; importId?: string; search?: string; unit?: string; group?: DocumentGroup };
  createdBy: User;
  _count?: { documents: number };
};
