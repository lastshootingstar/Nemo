import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { Dataset } from '../types/data';
import { ChatRequest, ChatResponse } from '../types/api';

export class GeminiService {
  private static instance: GeminiService;
  private genAI: GoogleGenerativeAI;

  private constructor() {
    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey) {
      console.warn('GEMINI_API_KEY not found in environment variables');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  public static getInstance(): GeminiService {
    if (!GeminiService.instance) {
      GeminiService.instance = new GeminiService();
    }
    return GeminiService.instance;
  }

  async processNaturalLanguageQuery(request: ChatRequest, dataset: Dataset): Promise<ChatResponse> {
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const systemPrompt = this.buildSystemPrompt(dataset);
      const userMessage = this.buildUserMessage(request.message, dataset);

      const chat = model.startChat({
        history: [{ role: 'user', parts: [{ text: systemPrompt }] }],
        generationConfig: {
          maxOutputTokens: 2000,
          temperature: 0.3,
        },
      });

      const result = await chat.sendMessage(userMessage);
      const aiResponse = result.response.text();
      
      const parsedResponse = this.parseAIResponse(aiResponse, dataset);

      return {
        response: parsedResponse.explanation,
        analysis: parsedResponse.analysis,
        visualization: parsedResponse.visualization,
        suggestions: parsedResponse.suggestions
      };

    } catch (error) {
      console.error('Gemini API error:', error);
      throw new Error('Failed to process natural language query with Gemini. Please try again.');
    }
  }

  private buildSystemPrompt(dataset: Dataset): string {
    const columnInfo = dataset.columns.map(col => {
      const sampleValues = dataset.rows.slice(0, 3).map(row => row[col]).filter(val => val !== null);
      const dataType = this.inferColumnType(dataset, col);
      return `- ${col} (${dataType}): Sample values: ${sampleValues.join(', ')}`;
    }).join('\n');

    return `You are a data analysis assistant for NemoClinical, helping researchers and public health teams analyze their data.

Dataset Information:
- Name: ${dataset.name}
- Rows: ${dataset.metadata.rowCount}
- Columns: ${dataset.metadata.columnCount}
- File Type: ${dataset.metadata.fileType}

Available Columns:
${columnInfo}

Your role is to:
1. Understand natural language queries about the data
2. Suggest appropriate statistical analyses
3. Recommend visualizations
4. Provide clear explanations of results
5. Offer insights relevant to public health and research

When responding, structure your answer as a clean JSON object with these fields:
\`\`\`json
{
  "explanation": "Clear explanation of what analysis should be performed",
  "analysis": {
    "type": "descriptive|correlation|frequency|histogram|scatter|summary",
    "columns": ["column1", "column2"],
    "parameters": {}
  },
  "visualization": {
    "type": "bar|line|scatter|histogram|pie",
    "title": "Chart title",
    "description": "What the visualization shows"
  },
  "suggestions": ["Additional analysis suggestion 1", "Additional analysis suggestion 2"]
}
\`\`\`

Focus on providing actionable insights for healthcare and research contexts.`;
  }

  private buildUserMessage(message: string, dataset: Dataset): string {
    return `User Query: "${message}"

Please analyze this request in the context of the provided dataset and suggest the most appropriate statistical analysis and visualization. Consider the public health and research implications of the analysis.`;
  }

  private parseAIResponse(aiResponse: string, dataset: Dataset): {
    explanation: string;
    analysis?: any;
    visualization?: any;
    suggestions: string[];
  } {
    try {
      const jsonMatch = aiResponse.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch && jsonMatch[1]) {
        const parsed = JSON.parse(jsonMatch[1]);
        return {
          explanation: parsed.explanation || aiResponse,
          analysis: parsed.analysis,
          visualization: parsed.visualization,
          suggestions: parsed.suggestions || []
        };
      }
    } catch (error) {
      console.warn('Failed to parse structured AI response, using fallback');
    }

    const fallbackAnalysis = this.extractAnalysisIntent(aiResponse, dataset);
    
    return {
      explanation: aiResponse,
      analysis: fallbackAnalysis.analysis,
      visualization: fallbackAnalysis.visualization,
      suggestions: this.generateSuggestions(dataset)
    };
  }

  private extractAnalysisIntent(response: string, dataset: Dataset): {
    analysis?: any;
    visualization?: any;
  } {
    const lowerResponse = response.toLowerCase();
    const numericColumns = this.getNumericColumns(dataset);
    const allColumns = dataset.columns;

    if (lowerResponse.includes('correlation') || lowerResponse.includes('relationship')) {
      if (numericColumns.length >= 2) {
        return {
          analysis: { type: 'correlation', columns: numericColumns.slice(0, 2) },
          visualization: { type: 'scatter', title: `Correlation between ${numericColumns[0]} and ${numericColumns[1]}`, description: 'Scatter plot showing the relationship' }
        };
      }
    }

    if (lowerResponse.includes('distribution') || lowerResponse.includes('histogram')) {
      if (numericColumns.length > 0) {
        return {
          analysis: { type: 'histogram', columns: [numericColumns[0]] },
          visualization: { type: 'histogram', title: `Distribution of ${numericColumns[0]}`, description: 'Histogram showing value distribution' }
        };
      }
    }

    if (lowerResponse.includes('frequency') || lowerResponse.includes('count')) {
      return {
        analysis: { type: 'frequency', columns: [allColumns[0]] },
        visualization: { type: 'bar', title: `Frequency of ${allColumns[0]}`, description: 'Bar chart of frequency distribution' }
      };
    }

    if (lowerResponse.includes('summary') || lowerResponse.includes('overview')) {
      return { analysis: { type: 'summary', columns: [] } };
    }

    if (numericColumns.length > 0) {
      return { analysis: { type: 'descriptive', columns: [numericColumns[0]] } };
    }

    return {};
  }

  private inferColumnType(dataset: Dataset, columnName: string): string {
    const values = dataset.rows.map(row => row[columnName]).filter(val => val !== null);
    if (values.length === 0) return 'unknown';

    const firstValue = values[0];
    if (typeof firstValue === 'number') return 'numeric';
    if (typeof firstValue === 'boolean') return 'boolean';
    
    if (typeof firstValue === 'string' && !isNaN(Date.parse(firstValue))) {
      return 'date';
    }
    
    return 'categorical';
  }

  private getNumericColumns(dataset: Dataset): string[] {
    return dataset.columns.filter(col => {
      const values = dataset.rows.map(row => row[col]).filter(val => val !== null);
      return values.length > 0 && typeof values[0] === 'number';
    });
  }

  private generateSuggestions(dataset: Dataset): string[] {
    const suggestions: string[] = [];
    const numericColumns = this.getNumericColumns(dataset);
    
    if (numericColumns.length >= 2) {
      suggestions.push('Explore correlations between numeric variables');
    }
    if (numericColumns.length > 0) {
      suggestions.push('Generate descriptive statistics for key variables');
    }
    suggestions.push('Analyze frequency distributions of categorical variables');
    
    return suggestions;
  }
}