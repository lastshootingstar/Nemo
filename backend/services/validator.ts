import Joi from 'joi';
import FileType from 'file-type';
import sanitize from 'sanitize-filename';

export class DataValidator {
  private static instance: DataValidator;

  public static getInstance(): DataValidator {
    if (!DataValidator.instance) {
      DataValidator.instance = new DataValidator();
    }
    return DataValidator.instance;
  }

  private readonly uploadSchema = Joi.object({
    filename: Joi.string().required().max(255),
    mimetype: Joi.string().valid(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv',
      'application/octet-stream'
    ).required(),
    size: Joi.number().max(50 * 1024 * 1024) // 50MB limit
  });

  private readonly chatSchema = Joi.object({
    message: Joi.string().required().min(1).max(1000),
    datasetId: Joi.string().uuid().required(),
    context: Joi.array().items(Joi.string()).optional()
  });

  async validateUploadedFile(file: Express.Multer.File): Promise<{ isValid: boolean; error?: string; sanitizedName?: string }> {
    try {
      // Validate basic file properties
      const { error } = this.uploadSchema.validate({
        filename: file.originalname,
        mimetype: file.mimetype,
        size: file.size
      });

      if (error) {
        return { isValid: false, error: error.details[0].message };
      }

      // Validate file type by reading file buffer
      const fileType = await FileType.fromBuffer(file.buffer);
      const allowedTypes = ['xlsx', 'xls', 'csv'];
      
      if (fileType && !allowedTypes.includes(fileType.ext)) {
        return { isValid: false, error: 'Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed.' };
      }

      // Sanitize filename
      const sanitizedName = sanitize(file.originalname);
      if (!sanitizedName) {
        return { isValid: false, error: 'Invalid filename' };
      }

      return { isValid: true, sanitizedName };
    } catch (error) {
      return { isValid: false, error: 'File validation failed' };
    }
  }

  validateChatRequest(data: any): { isValid: boolean; error?: string } {
    const { error } = this.chatSchema.validate(data);
    if (error) {
      return { isValid: false, error: error.details[0].message };
    }
    return { isValid: true };
  }

  validateColumnName(columnName: string, availableColumns: string[]): { isValid: boolean; error?: string } {
    if (!columnName || typeof columnName !== 'string') {
      return { isValid: false, error: 'Column name is required and must be a string' };
    }

    if (!availableColumns.includes(columnName)) {
      return { isValid: false, error: `Column '${columnName}' not found. Available columns: ${availableColumns.join(', ')}` };
    }

    return { isValid: true };
  }

  validateNumericColumns(columns: string[], dataset: any): { isValid: boolean; error?: string; validColumns?: string[] } {
    const numericColumns = dataset.columns.filter((col: string) => {
      const values = dataset.rows.map((row: any) => row[col]).filter((val: any) => val !== null);
      return values.length > 0 && typeof values[0] === 'number';
    });

    const invalidColumns = columns.filter(col => !numericColumns.includes(col));
    
    if (invalidColumns.length > 0) {
      return { 
        isValid: false, 
        error: `Non-numeric columns detected: ${invalidColumns.join(', ')}. Available numeric columns: ${numericColumns.join(', ')}` 
      };
    }

    return { isValid: true, validColumns: numericColumns };
  }

  sanitizeUserInput(input: string): string {
    // Remove potentially dangerous characters and limit length
    return input
      .replace(/[<>\"'&]/g, '') // Remove HTML/script injection characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .substring(0, 1000); // Limit length
  }

  validateDatasetExists(datasetId: string, datasets: Map<string, any>): { isValid: boolean; error?: string } {
    if (!datasets.has(datasetId)) {
      return { isValid: false, error: 'Dataset not found. Please upload a dataset first.' };
    }
    return { isValid: true };
  }
}

