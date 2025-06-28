import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { GeminiService } from '../services/geminiService';
import { DataValidator } from '../services/validator';
import { ApiResponse, ChatRequest } from '../types/api';
import { datasets } from './upload';
import { DataAnalyzer } from '../services/dataAnalyzer';

const chat = new Hono();

// Enable CORS for all routes
chat.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

const geminiService = GeminiService.getInstance();
const validator = DataValidator.getInstance();
const dataAnalyzer = DataAnalyzer.getInstance();

// Store chat history for context (in production, use a database)
const chatHistory = new Map<string, Array<{ role: string; content: string; timestamp: string; analysisResults?: any }>>();

function isStatisticalQuery(message: string): string | null {
  const lowerMsg = message.toLowerCase();
  if (lowerMsg.includes('correlation')) return 'correlation';
  if (lowerMsg.includes('histogram')) return 'histogram';
  if (lowerMsg.includes('frequency')) return 'frequency';
  if (
    lowerMsg.includes('summary') ||
    lowerMsg.includes('describe') ||
    lowerMsg.includes('descriptive statistics') ||
    lowerMsg.includes('mean') ||
    lowerMsg.includes('average') ||
    lowerMsg.includes('median') ||
    lowerMsg.includes('standard deviation') ||
    lowerMsg.includes('variance') ||
    lowerMsg.includes('distribution')
  ) return 'summary';
  return null;
}

chat.post('/query', async (c) => {
  try {
    const body = await c.req.json();
    const { message, datasetId } = body as ChatRequest;

    // Validate request
    const validation = validator.validateChatRequest(body);
    if (!validation.isValid) {
      return c.json<ApiResponse>({
        success: false,
        error: validation.error
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
    const sanitizedMessage = validator.sanitizeUserInput(message);

    // Get or create chat history for this dataset
    if (!chatHistory.has(datasetId)) {
      chatHistory.set(datasetId, []);
    }
    const history = chatHistory.get(datasetId)!;

    // Add user message to history
    history.push({
      role: 'user',
      content: sanitizedMessage,
      timestamp: new Date().toISOString()
    });

    // Decide which statistical analysis to perform
    let analysisResults = null;
    let explanation = "Performing analysis as requested.";
    let analysisType: string | null = null;
    let analysisColumns: string[] | null = null;

    const lowerMsg = sanitizedMessage.toLowerCase();

    if (lowerMsg.includes('correlation')) {
      explanation = "Performing correlation analysis.";
      analysisType = 'correlation';
      analysisColumns = dataset.columns.filter(col => {
        const values = dataset.rows.map(row => row[col]).filter(val => val !== null && typeof val === 'number');
        return values.length > 0;
      }).slice(0, 2);
    } else if (lowerMsg.includes('histogram')) {
      explanation = "Generating histogram.";
      analysisType = 'histogram';
      analysisColumns = dataset.columns.filter(col => {
        const values = dataset.rows.map(row => row[col]).filter(val => val !== null && typeof val === 'number');
        return values.length > 0;
      }).slice(0, 1);
    } else if (lowerMsg.includes('frequency')) {
      explanation = "Generating frequency distribution.";
      analysisType = 'frequency';
      analysisColumns = [dataset.columns[0]];
    } else if (lowerMsg.includes('summary') || lowerMsg.includes('describe')) {
      explanation = "Generating summary statistics.";
      analysisType = 'summary';
      analysisColumns = [];
    } else {
      explanation = "Sorry, I could not understand your statistical request. Try keywords like 'correlation', 'histogram', 'frequency', or 'summary'.";
    }

    if (analysisType) {
      try {
        switch (analysisType) {
          case 'correlation':
            if (analysisColumns && analysisColumns.length >= 2) {
              analysisResults = await dataAnalyzer.calculateCorrelation(dataset, analysisColumns[0]!, analysisColumns[1]!);
              explanation = `Correlation analysis completed for columns: ${analysisColumns[0]} and ${analysisColumns[1]}.`;
            } else {
              explanation = "Need at least two numeric columns for correlation analysis.";
            }
            break;
          case 'histogram':
            if (analysisColumns && analysisColumns.length >= 1) {
              analysisResults = await dataAnalyzer.generateHistogram(dataset, analysisColumns[0]!);
              explanation = `Histogram generated for column: ${analysisColumns[0]}.`;
            } else {
              explanation = "Need at least one numeric column for histogram.";
            }
            break;
          case 'frequency':
            if (analysisColumns && analysisColumns.length >= 1) {
              analysisResults = await dataAnalyzer.generateFrequencyDistribution(dataset, analysisColumns[0]!);
              explanation = `Frequency distribution generated for column: ${analysisColumns[0]}.`;
            } else {
              explanation = "Need at least one column for frequency distribution.";
            }
            break;
          case 'summary':
            analysisResults = await dataAnalyzer.getSummaryStatistics(dataset);
            explanation = "Summary statistics generated for the dataset.";
          break;
          default:
            explanation = "Statistical analysis type not recognized.";
        }
      } catch (e) {
        explanation = "Error during statistical analysis.";
      }
    } else {
        const chatRequest: ChatRequest = {
            message: sanitizedMessage,
            datasetId
        };
        const geminiResponse = await geminiService.processNaturalLanguageQuery(chatRequest, dataset);
        explanation = geminiResponse.response;
        analysisResults = null;
    }

    // Add AI (system) response to history
    history.push({
      role: 'assistant',
      content: explanation,
      analysisResults: analysisResults,
      timestamp: new Date().toISOString()
    });

    // Limit history size (keep last 20 messages)
    if (history.length > 20) {
      history.splice(0, history.length - 20);
    }

    return c.json<ApiResponse>({
      success: true,
      data: {
        response: explanation,
        analysisResults: analysisResults
      },
      message: 'Query processed successfully'
    });

  } catch (error) {
    console.error('Chat query error:', error);
    return c.json<ApiResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process query'
    }, 500);
  }
});

// The rest of the endpoints stay the same except for /insights, which no longer calls Gemini.
// You may remove or rewrite /insights as needed.

chat.get('/history/:datasetId', async (c) => {
  try {
    const datasetId = c.req.param('datasetId');
    const datasetValidation = validator.validateDatasetExists(datasetId, datasets);
    if (!datasetValidation.isValid) {
      return c.json<ApiResponse>({
        success: false,
        error: datasetValidation.error
      }, 404);
    }
    const history = chatHistory.get(datasetId) || [];
    return c.json<ApiResponse>({
      success: true,
      data: history
    });
  } catch (error) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to retrieve chat history'
    }, 500);
  }
});

chat.delete('/history/:datasetId', async (c) => {
  try {
    const datasetId = c.req.param('datasetId');
    const datasetValidation = validator.validateDatasetExists(datasetId, datasets);
    if (!datasetValidation.isValid) {
      return c.json<ApiResponse>({
        success: false,
        error: datasetValidation.error
      }, 404);
    }
    chatHistory.delete(datasetId);
    return c.json<ApiResponse>({
      success: true,
      message: 'Chat history cleared successfully'
    });
  } catch (error) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to clear chat history'
    }, 500);
  }
});

chat.get('/suggestions/:datasetId', async (c) => {
  try {
    const datasetId = c.req.param('datasetId');
    const datasetValidation = validator.validateDatasetExists(datasetId, datasets);
    if (!datasetValidation.isValid) {
      return c.json<ApiResponse>({
        success: false,
        error: datasetValidation.error
      }, 404);
    }
    const dataset = datasets.get(datasetId)!;
    const suggestions: string[] = [];
    const numericColumns = dataset.columns.filter(col => {
      const values = dataset.rows.map(row => row[col]).filter(val => val !== null && typeof val === 'number');
      return values.length > 0;
    });
    if (numericColumns.length >= 2) {
      suggestions.push(`Analyze correlation between ${numericColumns[0]} and ${numericColumns[1]}`);
      suggestions.push(`Create a scatter plot of ${numericColumns[0]} vs ${numericColumns[1]}`);
    }
    if (numericColumns.length > 0) {
      suggestions.push(`Show descriptive statistics for ${numericColumns[0]}`);
      suggestions.push(`Generate a histogram of ${numericColumns[0]} distribution`);
    }
    suggestions.push(`Show frequency distribution of ${dataset.columns[0]}`);
    suggestions.push('Provide a summary of the entire dataset');
    suggestions.push('What are the key patterns in this data?');
    suggestions.push('Are there any outliers or unusual values?');
    return c.json<ApiResponse>({
      success: true,
      data: { suggestions }
    });
  } catch (error) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to generate suggestions'
    }, 500);
  }
});

chat.post('/chat/results-discussion', async (c) => {
  return c.json({ success: true, message: 'Results discussion endpoint' });
});

export default chat;
