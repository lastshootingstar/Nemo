export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface UploadResponse {
  datasetId: string;
  fileName: string;
  summary: {
    rows: number;
    columns: number;
    columnNames: string[];
  };
}

export interface ChatRequest {
  message: string;
  datasetId: string;
  context?: string[];
}

export interface ChatResponse {
  response: string;
  analysis?: any;
  visualization?: any;
  suggestions?: string[];
}

export interface ExportRequest {
  datasetId: string;
  format: 'csv' | 'xlsx' | 'json';
  includeAnalysis?: boolean;
}

