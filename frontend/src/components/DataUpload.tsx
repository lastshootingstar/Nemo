import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation } from '@tanstack/react-query';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, MessageSquare, BarChart3 } from 'lucide-react';

interface Dataset {
  id: string;
  name: string;
  fileName: string;
  uploadedAt: string;
  rows: number;
  columns: number;
}

interface DataUploadProps {
  onDatasetUploaded: (dataset: Dataset) => void;
}

interface UploadResponse {
  datasetId: string;
  fileName: string;
  summary: {
    rows: number;
    columns: number;
    columnNames: string[];
  };
}

const DataUpload: React.FC<DataUploadProps> = ({ onDatasetUploaded }) => {
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const uploadMutation = useMutation({
    mutationFn: async (file: File): Promise<UploadResponse> => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        try {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Upload failed');
        } catch (e) {
          throw new Error(response.statusText || 'An unknown error occurred');
        }
      }

      const result = await response.json();
      return result.data;
    },
    onMutate: () => {
      setUploadStatus('uploading');
      setErrorMessage('');
    },
    onSuccess: (data) => {
      setUploadStatus('success');
      const dataset: Dataset = {
        id: data.datasetId,
        name: data.fileName.replace(/\.[^/.]+$/, ''),
        fileName: data.fileName,
        uploadedAt: new Date().toISOString(),
        rows: data.summary.rows,
        columns: data.summary.columns,
      };
      onDatasetUploaded(dataset);
    },
    onError: (error: Error) => {
      setUploadStatus('error');
      setErrorMessage(error.message);
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      uploadMutation.mutate(acceptedFiles[0]);
    }
  }, [uploadMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024, // 50MB
  });

  return (
    <div className="w-full">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Upload Your Dataset
        </h2>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Upload Excel (.xlsx, .xls) or CSV files to start analyzing your data with AI-powered insights
        </p>
      </div>

      {/* Upload Area */}
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
          ${isDragActive
            ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
            : uploadStatus === 'error'
            ? 'border-red-300 bg-red-50 dark:bg-red-900/20'
            : uploadStatus === 'success'
            ? 'border-green-300 bg-green-50 dark:bg-green-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }
        `}
      >
        <input {...getInputProps()} />
        
        <div className="space-y-4">
          {uploadStatus === 'uploading' ? (
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                Processing your file...
              </p>
            </div>
          ) : uploadStatus === 'success' ? (
            <div className="flex flex-col items-center">
              <CheckCircle className="h-12 w-12 text-green-600" />
              <p className="mt-4 text-lg font-medium text-green-600">
                File uploaded successfully!
              </p>
            </div>
          ) : uploadStatus === 'error' ? (
            <div className="flex flex-col items-center">
              <AlertCircle className="h-12 w-12 text-red-600" />
              <p className="mt-4 text-lg font-medium text-red-600">
                Upload failed
              </p>
              <p className="text-sm text-red-500 mt-2">{errorMessage}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              {isDragActive ? (
                <Upload className="h-12 w-12 text-blue-600" />
              ) : (
                <FileSpreadsheet className="h-12 w-12 text-gray-400" />
              )}
              <p className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                {isDragActive ? 'Drop your file here' : 'Drag & drop your file here'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                or click to browse files
              </p>
            </div>
          )}
        </div>
      </div>

      {/* File Requirements */}
      <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          File Requirements
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-400">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Supported Formats</h4>
            <ul className="space-y-1">
              <li>• Excel files (.xlsx, .xls)</li>
              <li>• CSV files (.csv)</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Limitations</h4>
            <ul className="space-y-1">
              <li>• Maximum file size: 50MB</li>
              <li>• First row should contain column headers</li>
              <li>• Data should be in tabular format</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Features Preview */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="text-center p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mx-auto mb-4">
            <FileSpreadsheet className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Data Processing
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Automatic parsing and validation of your data with intelligent type detection
          </p>
        </div>

        <div className="text-center p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            AI Analysis
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Ask questions about your data in natural language and get instant insights
          </p>
        </div>

        <div className="text-center p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-6 h-6 text-purple-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Visualizations
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Generate interactive charts and graphs to explore your data visually
          </p>
        </div>
      </div>
    </div>
  );
};

export default DataUpload;

