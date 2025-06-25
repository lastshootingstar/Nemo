import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { GeminiService } from '../services/geminiService';
import { DataValidator } from '../services/validator';
import { ApiResponse, ChatRequest, ChatResponse } from '../types/api';
import { datasets } from './upload';

const chat = new Hono();

// Enable CORS for all routes
chat.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

const geminiService = GeminiService.getInstance();
const validator = DataValidator.getInstance();

// Store chat history for context (in production, use a database)
const chatHistory = new Map<string, Array<{ role: string; content: string; timestamp: string }>>();

chat.post('/query', async (c) => {
  try {
    const body = await c.req.json();
    const { message, datasetId, context } = body as ChatRequest;

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

    // Sanitize user input
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

    // Process the query with DeepSeek
    const chatRequest: ChatRequest = {
      message: sanitizedMessage,
      datasetId,
      context: context || history.slice(-5).map(h => h.content) // Last 5 messages for context
    };

    const response = await geminiService.processNaturalLanguageQuery(chatRequest, dataset);

    // Add AI response to history
    history.push({
      role: 'assistant',
      content: response.response,
      timestamp: new Date().toISOString()
    });

    // Limit history size (keep last 20 messages)
    if (history.length > 20) {
      history.splice(0, history.length - 20);
    }

    return c.json<ApiResponse<ChatResponse>>({
      success: true,
      data: response,
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

chat.get('/history/:datasetId', async (c) => {
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

    // Validate dataset exists
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

chat.post('/insights/:datasetId', async (c) => {
  try {
    const datasetId = c.req.param('datasetId');
    const body = await c.req.json();
    const { analysisResults } = body;

    // Validate dataset exists
    const datasetValidation = validator.validateDatasetExists(datasetId, datasets);
    if (!datasetValidation.isValid) {
      return c.json<ApiResponse>({
        success: false,
        error: datasetValidation.error
      }, 404);
    }

    const dataset = datasets.get(datasetId)!;

    if (!analysisResults || !Array.isArray(analysisResults)) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Analysis results are required and must be an array'
      }, 400);
    }

    // Since the new Gemini service does not have a separate "generateInsights" method,
    // we will call the primary query method and pass the analysis results as context.
    const insightRequest: ChatRequest = {
      message: `Generate insights based on these analysis results: ${JSON.stringify(analysisResults, null, 2)}`,
      datasetId,
    };
    const insightResponse = await geminiService.processNaturalLanguageQuery(insightRequest, dataset);
    const insights = insightResponse.response;

    return c.json<ApiResponse>({
      success: true,
      data: { insights }
    });

  } catch (error) {
    console.error('Insights generation error:', error);
    return c.json<ApiResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate insights'
    }, 500);
  }
});

chat.get('/suggestions/:datasetId', async (c) => {
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

    // Generate basic suggestions based on dataset structure
    const suggestions: string[] = [];
    const numericColumns = dataset.columns.filter(col => {
      const values = dataset.rows.map(row => row[col]).filter(val => val !== null);
      return values.length > 0 && typeof values[0] === 'number';
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

export default chat;

