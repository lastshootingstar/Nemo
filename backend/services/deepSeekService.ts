import axios from 'axios';
import { Dataset } from '../types/data';
import { ChatRequest, ChatResponse } from '../types/api';

export class DeepSeekService {
  private static instance: DeepSeekService;
  private apiKey: string;
  private baseUrl: string = 'https://api.deepseek.com/v1';

  private constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY || '';
    if (!this.apiKey) {
      console.warn('DEEPSEEK_API_KEY not found in environment variables');
    }
  }

  public static getInstance(): DeepSeekService {
    if (!DeepSeekService.instance) {
      DeepSeekService.instance = new DeepSeekService();
    }
    return DeepSeekService.instance;
  }

  async processNaturalLanguageQuery(request: ChatRequest, dataset: Dataset): Promise<ChatResponse> {
    try {
      const systemPrompt = this.buildSystemPrompt(dataset);
      const userMessage = this.buildUserMessage(request.message, dataset);

      const response = await axios.post(
        this.baseUrl,
        {
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          temperature: 0.3,
          max_tokens: 2000
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const aiResponse = response.data.choices[0].message.content;

      // Parse the AI response to extract analysis instructions
      const parsedResponse = this.parseAIResponse(aiResponse, dataset);

      return {
        response: parsedResponse.explanation,
        analysis: parsedResponse.analysis,
        visualization: parsedResponse.visualization,
        suggestions: parsedResponse.suggestions
      };

    } catch (error) {
      console.error('DeepSeek API error:', error);

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error('Invalid API key. Please check your DeepSeek API configuration.');
        } else if (error.response?.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        }
      }

      throw new Error('Failed to process natural language query. Please try again.');
    }
  }

  private buildSystemPrompt(dataset: Dataset): string {
    const columnInfo = dataset.columns.map(col => {
      const sampleValues = dataset.rows.slice(0, 3).map(row => row[col]).filter(val => val !== null);
      const dataType = this.inferColumnType(dataset, col);
      return `- ${col} (${dataType}): Sample values: ${sampleValues.join(', ')}`;
    }).join('\n');

    // Add information about available statistical tests
    const availableTests = [
      'descriptive statistics',
      'correlation analysis',
      'frequency distribution',
      'histogram',
      't-test',
      'anova',
      'linear regression',
      'logistic regression'
    ].join(', ');

    return `You are a data analysis assistant for NemoClinical, helping researchers and public health teams analyze their data.

Dataset Information:
- Name: ${dataset.name}
- Rows: ${dataset.metadata.rowCount}
- Columns: ${dataset.metadata.columnCount}
- File Type: ${dataset.metadata.fileType}

Available Columns:
${columnInfo}

Available Statistical Tests:
${availableTests}

Your role is to:
1. Understand natural language queries about the data
2. Suggest appropriate statistical analyses
3. Recommend visualizations
4. Provide clear explanations of results
5. Offer insights relevant to public health and research

When responding, structure your answer as JSON with these fields:
{
  "explanation": "Clear explanation of what analysis should be performed",
  "analysis": {
    "type": "descriptive|correlation|frequency|histogram|t-test|anova|linear regression|logistic regression",
    "columns": ["column1", "column2"],
    "parameters": {}
  },
  "visualization": {
    "type": "bar|line|scatter|histogram|pie|box plot",
    "title": "Chart title",
    "description": "What the visualization shows"
  },
  "suggestions": ["Additional analysis suggestion 1", "Additional analysis suggestion 2"]
}

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
      // Try to extract JSON from the response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          explanation: parsed.explanation || aiResponse,
          analysis: parsed.analysis,
          visualization: parsed.visualization,
          suggestions: parsed.suggestions || this.generateSuggestions(dataset, parsed.analysis) // Pass analysis to generateSuggestions
        };
      }
    } catch (error) {
      console.warn('Failed to parse structured AI response, using fallback');
    }

    // Fallback: analyze the text response to extract intent
    const fallbackAnalysis = this.extractAnalysisIntent(aiResponse, dataset);

    return {
      explanation: aiResponse,
      analysis: fallbackAnalysis.analysis,
      visualization: fallbackAnalysis.visualization,
      suggestions: this.generateSuggestions(dataset, fallbackAnalysis.analysis) // Pass analysis to generateSuggestions
    };
  }

  private extractAnalysisIntent(response: string, dataset: Dataset): {
    analysis?: any;
    visualization?: any;
  } {
    const lowerResponse = response.toLowerCase();
    const numericColumns = this.getNumericColumns(dataset);
    const allColumns = dataset.columns;

    // Detect analysis type based on keywords
    if (lowerResponse.includes('correlation') || lowerResponse.includes('relationship')) {
      if (numericColumns.length >= 2) {
        return {
          analysis: {
            type: 'correlation',
            columns: numericColumns.slice(0, 2)
          },
          visualization: {
            type: 'scatter',
            title: `Correlation between ${numericColumns[0]} and ${numericColumns[1]}`,
            description: 'Scatter plot showing the relationship between variables'
          }
        };
      }
    }

    if (lowerResponse.includes('distribution') || lowerResponse.includes('histogram')) {
      if (numericColumns.length > 0) {
        return {
          analysis: {
            type: 'histogram',
            columns: [numericColumns[0]]
          },
          visualization: {
            type: 'histogram',
            title: `Distribution of ${numericColumns[0]}`,
            description: 'Histogram showing the distribution of values'
          }
        };
      }
    }

    if (lowerResponse.includes('frequency') || lowerResponse.includes('count')) {
      return {
        analysis: {
          type: 'frequency',
          columns: [allColumns[0]]
        },
        visualization: {
          type: 'bar',
          title: `Frequency of ${allColumns[0]}`,
          description: 'Bar chart showing frequency distribution'
        }
      };
    }

    if (lowerResponse.includes('summary') || lowerResponse.includes('overview')) {
      return {
        analysis: {
          type: 'summary',
          columns: []
        }
      };
    }

    // Default to descriptive statistics for the first numeric column
    if (numericColumns.length > 0) {
      return {
        analysis: {
          type: 'descriptive',
          columns: [numericColumns[0]]
        }
      };
    }

    return {};
  }

  private inferColumnType(dataset: Dataset, columnName: string): string {
    const values = dataset.rows.map(row => row[columnName]).filter(val => val !== null);
    if (values.length === 0) return 'unknown';

    const firstValue = values[0];
    if (typeof firstValue === 'number') return 'numeric';
    if (typeof firstValue === 'boolean') return 'boolean';

    // Check if it's a date
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

  private generateSuggestions(dataset: Dataset, analysis?: any): string[] {
    const suggestions: string[] = [];
    const numericColumns = this.getNumericColumns(dataset);

    if (analysis?.type === 'correlation') {
      suggestions.push('Explore scatter plot to visualize the correlation');
    }

    if (analysis?.type === 'histogram') {
      suggestions.push('Check descriptive statistics for more details');
    }

    if (numericColumns.length >= 2) {
      suggestions.push('Explore correlations between numeric variables');
      suggestions.push('Create scatter plots to visualize relationships');
    }

    if (numericColumns.length > 0) {
      suggestions.push('Generate descriptive statistics for key variables');
      suggestions.push('Create histograms to understand data distributions');
    }

    suggestions.push('Analyze frequency distributions of categorical variables');
    suggestions.push('Look for patterns that might indicate public health trends');

    return suggestions;
  }

  async generateInsights(dataset: Dataset, analysisResults: any[]): Promise<string> {
    try {
      const systemPrompt = `You are a public health data analyst. Based on the dataset and analysis results, provide meaningful insights and recommendations for researchers and public health professionals.

Dataset: ${dataset.name} (${dataset.metadata.rowCount} rows, ${dataset.metadata.columnCount} columns)

Focus on:
1. Key findings and patterns
2. Public health implications
3. Recommendations for further analysis
4. Potential limitations or considerations

Keep insights concise but actionable.`;

      const userMessage = `Analysis Results: ${JSON.stringify(analysisResults, null, 2)}

Please provide insights and recommendations based on these results.`;

      const response = await axios.post(
        this.baseUrl,
        {
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          temperature: 0.4,
          max_tokens: 1000
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.choices[0].message.content;

    } catch (error) {
      console.error('Failed to generate insights:', error);
      return 'Unable to generate insights at this time. Please review the analysis results manually.';
    }
  }
}
