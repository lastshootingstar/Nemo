# NemoClinical - Data Analysis Platform

A data analysis application prototype for researchers and public health teams, built with Hono + TypeScript + React architecture, featuring Excel/CSV file upload, DeepSeek API integration for natural language data queries, and interactive statistical visualizations.

## Features

- **File Upload**: Support for Excel (.xlsx, .xls) and CSV files
- **Data Processing**: Automatic parsing and validation with intelligent type detection
- **AI Analysis**: Natural language queries powered by DeepSeek API
- **Interactive Visualizations**: Charts and graphs using Recharts
- **Statistical Analysis**: Descriptive statistics, correlations, histograms, and more

## Architecture

### Backend (Port 7776)
- **Framework**: Hono with TypeScript
- **File Processing**: ExcelJS for Excel files, csv-parser for CSV
- **AI Integration**: DeepSeek API for natural language processing
- **Statistics**: Simple-statistics library for calculations
- **Validation**: Joi for data validation

### Frontend (Port 3000)
- **Framework**: React with TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts for data visualizations
- **State Management**: TanStack Query
- **File Upload**: React Dropzone

## Setup Instructions

### Prerequisites
- Node.js (v18 or higher)
- npm

### Backend Setup
1. Navigate to the backend directory:
   bash
   cd backend
   

2. Install dependencies:
   bash
   npm install
   

3. Create environment file:
   bash
   cp .env.example .env
   

4. Add your DeepSeek API key to `.env`:
   
   DEEPSEEK_API_KEY=your_api_key_here
   PORT=7776
   

5. Start the backend server:
   bash
   npm start
   

### Frontend Setup
1. Open a new terminal and navigate to the frontend directory:
   bash
   cd frontend
   

2. Install dependencies:
   bash
   npm install
   

3. Start the frontend development server:
   bash
   npm start
   

### Access the Application
- Frontend: http://localhost:3000
- Backend API: http://localhost:7776

## Usage

1. **Upload Data**: Use the upload interface to upload Excel or CSV files
2. **Preview Data**: View your dataset structure and column information
3. **AI Analysis**: Ask questions about your data in natural language
4. **Visualizations**: Generate charts and statistical analyses
5. **Export**: Download results and visualizations

## API Endpoints

### Upload
- `POST /api/upload/upload` - Upload a file
- `GET /api/upload/datasets` - List all datasets
- `GET /api/upload/datasets/:id` - Get dataset details
- `DELETE /api/upload/datasets/:id` - Delete a dataset

### Analysis
- `POST /api/analysis/descriptive/:datasetId/:column` - Descriptive statistics
- `POST /api/analysis/correlation/:datasetId` - Correlation analysis
- `POST /api/analysis/frequency/:datasetId/:column` - Frequency distribution
- `POST /api/analysis/histogram/:datasetId/:column` - Histogram
- `POST /api/analysis/scatter/:datasetId` - Scatter plot
- `GET /api/analysis/summary/:datasetId` - Summary statistics

### Chat
- `POST /api/chat/query` - Send natural language query
- `GET /api/chat/history/:datasetId` - Get chat history
- `DELETE /api/chat/history/:datasetId` - Clear chat history
- `GET /api/chat/suggestions/:datasetId` - Get query suggestions

## Sample Data

A sample CSV file is included (`test_data.csv`) with clinical trial data for testing the application.

## Technologies Used

### Backend
- Hono - Web framework
- TypeScript - Type safety
- ExcelJS - Excel file processing
- csv-parser - CSV file processing
- simple-statistics - Statistical calculations
- DeepSeek API - AI-powered analysis
- Joi - Data validation
- Multer - File upload handling

### Frontend
- React - UI framework
- TypeScript - Type safety
- Tailwind CSS - Styling
- Recharts - Data visualization
- TanStack Query - State management
- React Dropzone - File upload
- Lucide React - Icons

## Development

The application is designed with a modular architecture following SOLID principles:

- **Services**: Business logic and external integrations
- **Routes**: API endpoint handlers
- **Types**: TypeScript interfaces and types
- **Utils**: Utility functions
- **Components**: React UI components

## License

This project is a prototype for demonstration purposes.

