import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { GeminiService } from '../services/geminiService';
import { DataValidator } from '../services/validator';
import { ApiResponse, ChatRequest, ChatResponse } from '../types/api'; // Added ChatResponse
import { datasets } from './upload';
// import { DataAnalyzer } from '../services/dataAnalyzer'; // DataAnalyzer is used by GeminiService

const chat = new Hono();

// Enable CORS for all routes
chat.use('*', cors({
  origin: '*', // Allow all origins for simplicity in MVP. Restrict in production.
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

const geminiService = GeminiService.getInstance();
const validator = DataValidator.getInstance();
// const dataAnalyzer = DataAnalyzer.getInstance(); // Not directly used here anymore

// Store chat history for context (in production, use a database)
// The structure of history objects should align with what ChatInterface.tsx expects for display
const chatHistory = new Map<string, Array<{
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  analysis?: any; // from Gemini's response
  visualization?: any; // from Gemini's response
  suggestions?: string[]; // from Gemini's response
  analysisResults?: any; // actual results from DataAnalyzer via GeminiService
}>>();


chat.post('/query', async (c) => {
  try {
    const body = await c.req.json();
    const { message, datasetId } = body as ChatRequest;

    // Validate request
    const validation = validator.validateChatRequest(body);
    if (!validation.isValid) {
      return c.json<ApiResponse<null>>({ // Specify null for data type on error
        success: false,
        error: validation.error,
        data: null
      }, 400);
    }

    // Validate dataset exists
    const datasetValidation = validator.validateDatasetExists(datasetId, datasets);
    if (!datasetValidation.isValid) {
      return c.json<ApiResponse<null>>({
        success: false,
        error: datasetValidation.error,
        data: null
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

    // Process the query using GeminiService
    const chatRequest: ChatRequest = {
        message: sanitizedMessage,
        datasetId
    };
    const geminiServiceResponse: ChatResponse = await geminiService.processNaturalLanguageQuery(chatRequest, dataset);

    // Add AI response to history
    history.push({
      role: 'assistant',
      content: geminiServiceResponse.response, // Gemini's textual explanation
      analysis: geminiServiceResponse.analysis, // Gemini's suggested analysis object
      visualization: geminiServiceResponse.visualization, // Gemini's suggested visualization object
      suggestions: geminiServiceResponse.suggestions, // Gemini's suggestions
      analysisResults: geminiServiceResponse.analysisResults, // Structured results from DataAnalyzer
      timestamp: new Date().toISOString()
    });

    // Limit history size (keep last 20 messages, user + assistant = 10 exchanges)
    if (history.length > 20) {
      history.splice(0, history.length - 20);
    }

    // Return the full response from GeminiService, which includes explanation,
    // structured analysis results, visualization suggestions, etc.
    return c.json<ApiResponse<ChatResponse>>({
      success: true,
      data: geminiServiceResponse,
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
