import * as ExcelJS from 'exceljs';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { Dataset, DataRow, ColumnInfo } from '../types/data';
import { v4 as uuidv4 } from 'uuid';

export class FileProcessor {
  private static instance: FileProcessor;

  public static getInstance(): FileProcessor {
    if (!FileProcessor.instance) {
      FileProcessor.instance = new FileProcessor();
    }
    return FileProcessor.instance;
  }

  async processExcelFile(filePath: string, fileName: string): Promise<Dataset> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new Error('No worksheet found in Excel file');
    }

    const rows: DataRow[] = [];
    const columns: string[] = [];
    
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
      columns.push(cell.value?.toString() || `Column_${colNumber}`);
    });

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      
      const dataRow: DataRow = {};
      row.eachCell((cell, colNumber) => {
        const columnName = columns[colNumber - 1];
        dataRow[columnName] = this.parseValue(cell.value);
      });
      rows.push(dataRow);
    });

    return this.createDataset(fileName, columns, rows, 'xlsx');
  }

  public processCsvFile(fileBuffer: Buffer, fileName: string): Promise<Dataset> {
    return new Promise((resolve, reject) => {
      const results: DataRow[] = [];
      const stream = Readable.from(fileBuffer);

      stream
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
          if (results.length === 0) {
            return reject(new Error('CSV file is empty or invalid.'));
          }
          
          const columns = Object.keys(results[0]);
          const rows = results.map(row => {
            const newRow: DataRow = {};
            for (const key in row) {
              newRow[key] = this.parseValue(row[key]);
            }
            return newRow;
          });

          const dataset = this.createDataset(fileName, columns, rows, 'csv');
          resolve(dataset);
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  private parseValue(value: any): string | number | boolean | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const stringValue = value.toString().trim();
    if (stringValue.toLowerCase() === 'true') return true;
    if (stringValue.toLowerCase() === 'false') return false;
    const numericValue = Number(stringValue);
    if (!isNaN(numericValue) && isFinite(numericValue)) {
      return numericValue;
    }
    return stringValue;
  }

  private createDataset(fileName: string, columns: string[], rows: DataRow[], fileType: string): Dataset {
    return {
      id: uuidv4(),
      name: fileName.replace(/\.[^/.]+$/, ''),
      columns,
      rows,
      metadata: {
        rowCount: rows.length,
        columnCount: columns.length,
        uploadedAt: new Date().toISOString(),
        fileType,
        fileName
      }
    };
  }

  analyzeColumns(dataset: Dataset): ColumnInfo[] {
    return dataset.columns.map(columnName => {
      const values = dataset.rows.map(row => row[columnName]).filter(val => val !== null);
      const uniqueValues = new Set(values).size;
      const missingValues = dataset.rows.length - values.length;
      
      let type: 'string' | 'number' | 'boolean' | 'date' = 'string';
      
      if (values.length > 0) {
        const firstValue = values[0];
        if (typeof firstValue === 'number') {
          type = 'number';
        } else if (typeof firstValue === 'boolean') {
          type = 'boolean';
        } else if (this.isDateString(firstValue as string)) {
          type = 'date';
        }
      }

      return {
        name: columnName,
        type,
        nullable: missingValues > 0,
        uniqueValues,
        missingValues
      };
    });
  }

  private isDateString(value: string): boolean {
    if (typeof value !== 'string') return false;
    const date = new Date(value);
    return !isNaN(date.getTime()) && (value.includes('-') || value.includes('/'));
  }
}
