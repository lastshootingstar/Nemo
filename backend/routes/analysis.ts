import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { DataAnalyzer } from '../services/dataAnalyzer';
import { DataValidator } from '../services/validator';
import { ApiResponse } from '../types/api';
import { datasets } from './upload';

const analysis = new Hono();

// Enable CORS for all routes
analysis.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

const dataAnalyzer = DataAnalyzer.getInstance();
const validator = DataValidator.getInstance();

analysis.post('/descriptive/:datasetId/:column', async (c) => {
  try {
    const datasetId = c.req.param('datasetId');
    const columnName = c.req.param('column');

    // Validate dataset exists
    const datasetValidation = validator.validateDatasetExists(datasetId, datasets);
    if (!datasetValidation.isValid) {
      return c.json<ApiResponse>({
        success: false,
        error: datasetValidation.error
      }, 404);
    }

    const dataset = datasets.get(datasetId)!;

    // Validate column exists
    const columnValidation = validator.validateColumnName(columnName, dataset.columns);
    if (!columnValidation.isValid) {
      return c.json<ApiResponse>({
        success: false,
        error: columnValidation.error
      }, 400);
    }

    const stats = dataAnalyzer.calculateDescriptiveStats(dataset, columnName);

    return c.json<ApiResponse>({
      success: true,
      data: stats
    });

  } catch (error) {
    return c.json<ApiResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Analysis failed'
    }, 500);
  }
});

analysis.post('/correlation/:datasetId', async (c) => {
  try {
    const datasetId = c.req.param('datasetId');
    const body = await c.req.json();
    const { column1, column2 } = body;

    if (!column1 || !column2) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Both column1 and column2 are required'
      }, 400);
    }

    // Validate dataset exists
    const datasetValidation = validator.validateDatasetExists(datasetId, datasets);
    if (!datasetValidation.isValid) {
      return c.json<ApiResponse>({
        success: false,
        error: datasetValidation.error
      }, 404);
    }

    const dataset = datasets.get(datasetId)!;

    // Validate columns are numeric
    const numericValidation = validator.validateNumericColumns([column1, column2], dataset);
    if (!numericValidation.isValid) {
      return c.json<ApiResponse>({
        success: false,
        error: numericValidation.error
      }, 400);
    }

    const correlation = dataAnalyzer.calculateCorrelation(dataset, column1, column2);

    return c.json<ApiResponse>({
      success: true,
      data: correlation
    });

  } catch (error) {
    return c.json<ApiResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Correlation analysis failed'
    }, 500);
  }
});

analysis.get('/summary/:datasetId', async (c) => {
  try {
    const datasetId = c.req.param('datasetId');

    // Validate dataset exists
    const datasetValidation = validator.validateDatasetExists(datasetId, datasets);
    if (!datasetValidation.isValid) {
      return c.json<ApiResponse>({
        success: false,
        error: datasetValidation.error
      }, 404);
    }

    const dataset = datasets.get(datasetId)!;
    const summary = dataAnalyzer.getSummaryStatistics(dataset);

    return c.json<ApiResponse>({
      success: true,
      data: summary
    });

  } catch (error) {
    return c.json<ApiResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Summary analysis failed'
    }, 500);
  }
});

analysis.post('/frequency/:datasetId/:column', async (c) => {
  try {
    const datasetId = c.req.param('datasetId');
    const columnName = c.req.param('column');

    // Validate dataset exists
    const datasetValidation = validator.validateDatasetExists(datasetId, datasets);
    if (!datasetValidation.isValid) {
      return c.json<ApiResponse>({
        success: false,
        error: datasetValidation.error
      }, 404);
    }

    const dataset = datasets.get(datasetId)!;

    // Validate column exists
    const columnValidation = validator.validateColumnName(columnName, dataset.columns);
    if (!columnValidation.isValid) {
      return c.json<ApiResponse>({
        success: false,
        error: columnValidation.error
      }, 400);
    }

    const frequency = dataAnalyzer.generateFrequencyDistribution(dataset, columnName);

    return c.json<ApiResponse>({
      success: true,
      data: frequency
    });

  } catch (error) {
    return c.json<ApiResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Frequency analysis failed'
    }, 500);
  }
});

analysis.post('/histogram/:datasetId/:column', async (c) => {
  try {
    const datasetId = c.req.param('datasetId');
    const columnName = c.req.param('column');
    const body = await c.req.json().catch(() => ({}));
    const bins = body.bins || 10;

    // Validate dataset exists
    const datasetValidation = validator.validateDatasetExists(datasetId, datasets);
    if (!datasetValidation.isValid) {
      return c.json<ApiResponse>({
        success: false,
        error: datasetValidation.error
      }, 404);
    }

    const dataset = datasets.get(datasetId)!;

    // Validate column is numeric
    const numericValidation = validator.validateNumericColumns([columnName], dataset);
    if (!numericValidation.isValid) {
      return c.json<ApiResponse>({
        success: false,
        error: numericValidation.error
      }, 400);
    }

    const histogram = dataAnalyzer.generateHistogram(dataset, columnName, bins);

    return c.json<ApiResponse>({
      success: true,
      data: histogram
    });

  } catch (error) {
    return c.json<ApiResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Histogram analysis failed'
    }, 500);
  }
});

analysis.post('/scatter/:datasetId', async (c) => {
  try {
    const datasetId = c.req.param('datasetId');
    const body = await c.req.json();
    const { xColumn, yColumn } = body;

    if (!xColumn || !yColumn) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Both xColumn and yColumn are required'
      }, 400);
    }

    // Validate dataset exists
    const datasetValidation = validator.validateDatasetExists(datasetId, datasets);
    if (!datasetValidation.isValid) {
      return c.json<ApiResponse>({
        success: false,
        error: datasetValidation.error
      }, 404);
    }

    const dataset = datasets.get(datasetId)!;

    // Validate columns are numeric
    const numericValidation = validator.validateNumericColumns([xColumn, yColumn], dataset);
    if (!numericValidation.isValid) {
      return c.json<ApiResponse>({
        success: false,
        error: numericValidation.error
      }, 400);
    }

    const scatterPlot = dataAnalyzer.generateScatterPlot(dataset, xColumn, yColumn);

    return c.json<ApiResponse>({
      success: true,
      data: scatterPlot
    });

  } catch (error) {
    return c.json<ApiResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Scatter plot analysis failed'
    }, 500);
  }
});

export default analysis;

