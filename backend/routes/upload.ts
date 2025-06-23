import { Hono } from 'hono';
import { cors } from 'hono/cors';
import * as path from 'path';
// Simplified and corrected FS (File System) imports
import { promises as fs } from 'fs';
import { existsSync, mkdirSync } from 'fs';
import { FileProcessor } from '../services/fileProcessor';
import { DataValidator } from '../services/validator';
import { ApiResponse, UploadResponse } from '../types/api';
import { Dataset } from '../types/data';

const upload = new Hono();

// Enable CORS for all routes
upload.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// In-memory storage for datasets (in production, use a database)
export const datasets = new Map<string, Dataset>();

const fileProcessor = FileProcessor.getInstance();
const validator = DataValidator.getInstance();

upload.post('/upload', async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return c.json<ApiResponse>({ success: false, error: 'No file uploaded' }, 400);
    }

    const buffer = await file.arrayBuffer();
    // This object is created just to satisfy the validator's expected format
    const multerFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: file.name,
      encoding: '7bit',
      mimetype: file.type,
      size: buffer.byteLength,
      buffer: Buffer.from(buffer),
      destination: '',
      filename: '',
      path: '',
      stream: null as any
    };

    const validation = await validator.validateUploadedFile(multerFile);
    if (!validation.isValid || !validation.sanitizedName) {
      return c.json<ApiResponse>({ success: false, error: validation.error }, 400);
    }

    const fileExtension = path.extname(validation.sanitizedName).toLowerCase();
    let dataset: Dataset;

    if (fileExtension === '.csv') {
      // For CSVs, process directly from the in-memory buffer
      const fileBuffer = Buffer.from(buffer);
      dataset = await fileProcessor.processCsvFile(fileBuffer, validation.sanitizedName);

    } else if (fileExtension === '.xlsx' || fileExtension === '.xls') {
      // For Excel, the library needs a temporary file path
      const uploadsDir = path.join(process.cwd(), 'data', 'uploads');
      if (!existsSync(uploadsDir)) {
        mkdirSync(uploadsDir, { recursive: true });
      }
      const tempFilePath = path.join(uploadsDir, validation.sanitizedName);
      
      try {
        await fs.writeFile(tempFilePath, Buffer.from(buffer));
        dataset = await fileProcessor.processExcelFile(tempFilePath, validation.sanitizedName);
      } finally {
        // IMPORTANT: Always clean up the temp file
        if (existsSync(tempFilePath)) {
          await fs.unlink(tempFilePath);
        }
      }
    } else {
      return c.json<ApiResponse>({ success: false, error: 'Unsupported file format' }, 400);
    }

    // If processing was successful, store the dataset
    datasets.set(dataset.id, dataset);

    const response: UploadResponse = {
      datasetId: dataset.id,
      fileName: dataset.metadata.fileName,
      summary: {
        rows: dataset.metadata.rowCount,
        columns: dataset.metadata.columnCount,
        columnNames: dataset.columns
      }
    };

    return c.json<ApiResponse<UploadResponse>>({
      success: true,
      data: response,
      message: 'File uploaded and processed successfully'
    });

  } catch (error) {
    console.error('Upload error:', error);
    return c.json<ApiResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    }, 500);
  }
});

// All other routes (GET, DELETE) remain the same...

upload.get('/datasets', async (c) => {
  try {
    const datasetList = Array.from(datasets.values()).map(d => ({
      id: d.id,
      name: d.name,
      fileName: d.metadata.fileName,
      uploadedAt: d.metadata.uploadedAt,
      rows: d.metadata.rowCount,
      columns: d.metadata.columnCount
    }));
    return c.json<ApiResponse>({ success: true, data: datasetList });
  } catch (error) {
    return c.json<ApiResponse>({ success: false, error: 'Failed to retrieve datasets' }, 500);
  }
});

upload.get('/datasets/:id', async (c) => {
  try {
    const datasetId = c.req.param('id');
    const dataset = datasets.get(datasetId);

    if (!dataset) {
      return c.json<ApiResponse>({ success: false, error: 'Dataset not found' }, 404);
    }

    const columnInfo = fileProcessor.analyzeColumns(dataset);
    return c.json<ApiResponse>({
      success: true,
      data: { ...dataset, columnInfo, preview: dataset.rows.slice(0, 10) }
    });
  } catch (error) {
    return c.json<ApiResponse>({ success: false, error: 'Failed to retrieve dataset' }, 500);
  }
});

upload.delete('/datasets/:id', async (c) => {
  try {
    const datasetId = c.req.param('id');
    if (!datasets.has(datasetId)) {
      return c.json<ApiResponse>({ success: false, error: 'Dataset not found' }, 404);
    }
    datasets.delete(datasetId);
    return c.json<ApiResponse>({ success: true, message: 'Dataset deleted successfully' });
  } catch (error) {
    return c.json<ApiResponse>({ success: false, error: 'Failed to delete dataset' }, 500);
  }
});

export default upload;
