export interface DataRow {
  [key: string]: string | number | boolean | null;
}

export interface Dataset {
  id: string;
  name: string;
  columns: string[];
  rows: DataRow[];
  metadata: {
    rowCount: number;
    columnCount: number;
    uploadedAt: string;
    fileType: string;
    fileName: string;
  };
}

export interface ColumnInfo {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  nullable: boolean;
  uniqueValues?: number;
  missingValues?: number;
}

export interface DataSummary {
  totalRows: number;
  totalColumns: number;
  columns: ColumnInfo[];
  preview: DataRow[];
}

