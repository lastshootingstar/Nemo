import { GoogleGenerativeAI } from '@google/generative-ai';
import { Dataset } from '../types/data';
import { ChatRequest, ChatResponse } from '../types/api';
// Import DataAnalyzer types if needed for more specific typing of results
import { DescriptiveStats, CorrelationResult, StatisticalResult } from '../types/analysis';


export class GeminiService {
  private static instance: GeminiService;
  private genAI: GoogleGenerativeAI;

  private constructor() {
    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey) {
      // In a real app, you might throw an error or have a more robust fallback
      console.warn('GEMINI_API_KEY not found in environment variables. GeminiService may not function.');
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

      // For simplicity, not including full chat history here, but could be added.
      const chat = model.startChat({
        history: [{ role: 'user', parts: [{ text: systemPrompt }] }],
        generationConfig: {
          maxOutputTokens: 2000, // Consider adjusting based on typical response size
          temperature: 0.3, // Lower temperature for more deterministic/factual responses
        },
      });

      const result = await chat.sendMessage(userMessage);
      const aiResponseText = result.response.text();

      // Attempt to parse the structured JSON from Gemini's response
      let parsedGeminiOutput = this.tryParseJsonFromGemini(aiResponseText);

      let structuredAnalysisResults: any = null; // This will hold results from DataAnalyzer

      if (parsedGeminiOutput && parsedGeminiOutput.analysis) {
        // If Gemini suggests an analysis, perform it
        structuredAnalysisResults = await this.performAnalysis(parsedGeminiOutput.analysis, dataset);
      } else if (!parsedGeminiOutput) {
        // Fallback if Gemini didn't return valid JSON or the expected structure
        // Try basic intent extraction from the raw text for analysis
        const fallbackIntent = this.extractAnalysisIntent(aiResponseText, dataset);
        if (fallbackIntent.analysis) {
            parsedGeminiOutput = { // Reconstruct a partial Gemini-like response
                explanation: aiResponseText, // Use raw response as explanation
                analysis: fallbackIntent.analysis,
                visualization: fallbackIntent.visualization,
                suggestions: this.generateSuggestions(dataset) // Generic suggestions
            };
            structuredAnalysisResults = await this.performAnalysis(fallbackIntent.analysis, dataset);
        } else {
            // If no analysis intent even from fallback, treat as general chat
             parsedGeminiOutput = {
                explanation: aiResponseText,
                suggestions: this.generateSuggestions(dataset) // Generic suggestions
            };
        }
      }


      return {
        response: parsedGeminiOutput?.explanation || aiResponseText, // Gemini's textual explanation
        analysis: parsedGeminiOutput?.analysis,      // Gemini's suggested analysis object (type, columns)
        visualization: parsedGeminiOutput?.visualization, // Gemini's suggested visualization
        suggestions: parsedGeminiOutput?.suggestions || [],   // Gemini's follow-up suggestions
        analysisResults: structuredAnalysisResults,  // Structured results from DataAnalyzer
      };

    } catch (error) {
      console.error('Gemini API error:', error);
      // Provide a user-friendly error message
      throw new Error('Failed to process natural language query with AI. Please check your query or try again later.');
    }
  }

  private tryParseJsonFromGemini(text: string): { explanation: string, analysis?: any, visualization?: any, suggestions?: string[] } | null {
    // Gemini is instructed to return JSON, but it might be wrapped in markdown ```json ... ```
    // or have leading/trailing text.
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    let jsonString = text;

    if (jsonMatch && jsonMatch[1]) {
      jsonString = jsonMatch[1];
    }

    try {
      const parsed = JSON.parse(jsonString);
      // Basic validation of expected structure
      if (parsed && typeof parsed.explanation === 'string') {
        return parsed;
      }
      return null;
    } catch (e) {
      // If parsing fails, it means Gemini didn't return the clean JSON as instructed.
      // The raw text will be used as the explanation in the fallback.
      console.warn('GeminiService: Failed to parse structured JSON from AI response.', e);
      return null;
    }
  }


  private buildSystemPrompt(dataset: Dataset): string {
    const columnInfo = dataset.columns.map(col => {
      const sampleValues = dataset.rows.slice(0, 3).map(row => String(row[col])).filter(val => val !== null && val.trim() !== '').join(', ');
      const dataType = this.inferColumnType(dataset, col);
      return `- ${col} (Type: ${dataType}): Samples: [${sampleValues || 'N/A'}]`;
    }).join('\n');

    // Updated system prompt
    return `You are an expert data analysis assistant for NemoClinical, designed to help medical researchers and public health teams.
Your goal is to understand user queries about their uploaded dataset and provide insightful, actionable responses.

Dataset Summary:
- Name: ${dataset.name}
- Total Rows: ${dataset.metadata.rowCount}
- Total Columns: ${dataset.metadata.columnCount}
- File Type: ${dataset.metadata.fileType}

Available Columns (with inferred types and sample values):
${columnInfo}

Your primary task is to:
1.  Interpret the user's natural language query.
2.  If the query implies a statistical analysis, identify the most appropriate test (e.g., descriptive statistics, correlation, t-test, chi-squared, frequency count, histogram generation).
3.  If an analysis is identified, specify the analysis type and the relevant column(s).
4.  Suggest a suitable visualization for the analysis or data exploration.
5.  Provide a concise explanation of your reasoning or the results.
6.  Offer relevant follow-up suggestions for further analysis or exploration.

IMPORTANT RESPONSE FORMAT:
Always structure your entire response as a single, clean JSON object. Do NOT include any text outside of this JSON structure, including markdown specifiers like \`\`\`json.

JSON Structure:
{
  "explanation": "A clear, concise explanation of your findings, the analysis performed, or why a certain analysis is appropriate. If the query is conversational (e.g. 'hello'), respond naturally here.",
  "analysis": {  // Include this object ONLY if a specific statistical analysis is identified and recommended.
    "type": "descriptive | correlation | frequency | histogram | scatter | summary | t-test | chi-squared", // Specify one type
    "columns": ["column_name1", "column_name2_if_applicable"], // Columns involved in the analysis, OR use parameters for specific roles
    "parameters": { // Optional: any specific parameters for the analysis, e.g., for a t-test: { "groupColumn": "treatment_group_column_name", "valueColumn": "value_to_test_column_name" }
      // "alpha": 0.05 // Example parameter
    }
  },
  "visualization": { // Include this object if a visualization is relevant.
    "type": "bar | line | scatter | histogram | pie | boxplot", // Specify one type
    "title": "Suggested title for the chart",
    "description": "Brief description of what the chart would show",
    "x_axis": "column_name_for_x_axis_if_applicable",
    "y_axis": "column_name_for_y_axis_if_applicable"
  },
  "suggestions": [ // Provide 2-3 relevant follow-up questions or analysis suggestions.
    "What is the distribution of [another_column]?",
    "Compare [columnA] between groups in [group_column]."
  ]
}

Example for a conversational query "What is this dataset about?":
{
  "explanation": "This dataset, '${dataset.name}', contains ${dataset.metadata.rowCount} records and ${dataset.metadata.columnCount} columns including ${dataset.columns.slice(0,3).join(', ')}. It appears to be related to [infer general topic if possible, otherwise state 'various data points']. You can ask me to describe specific columns or look for relationships.",
  "suggestions": [
    "Describe the column [some_column_name].",
    "Show the distribution of [some_numeric_column]."
  ]
}

Example for "Correlate age and bmi":
{
  "explanation": "I can perform a correlation analysis between 'age' and 'bmi' to see if there's a linear relationship.",
  "analysis": {
    "type": "correlation",
    "columns": ["age", "bmi"]
  },
  "visualization": {
    "type": "scatter",
    "title": "Scatter plot of Age vs BMI",
    "description": "Shows the relationship between age and BMI.",
    "x_axis": "age",
    "y_axis": "bmi"
  },
  "suggestions": [
    "What is the p-value for this correlation?",
    "Show descriptive statistics for age."
  ]
}

Focus on actionable insights for healthcare and research. Be precise.
If a query is ambiguous, ask for clarification in the 'explanation' field and provide suggestions for rephrasing.
If an analysis is not possible (e.g., wrong data type for requested column), explain why in the 'explanation' field.
Do not perform calculations yourself; only specify the analysis to be done. The system will execute it.
Ensure column names in your JSON response exactly match the names provided in "Available Columns".
`;
  }

  private buildUserMessage(message: string, dataset: Dataset): string {
    // User message remains simple, context is in the system prompt
    return `User Query: "${message}"`;
  }

  private parseAIResponse(aiResponse: string, dataset: Dataset): { // This method might be deprecated by tryParseJsonFromGemini
    explanation: string;
    analysis?: any;
    visualization?: any;
    suggestions: string[];
  } {
    // Fallback logic if tryParseJsonFromGemini fails or for older versions.
    // For new implementation, tryParseJsonFromGemini is primary.
    const parsedJson = this.tryParseJsonFromGemini(aiResponse);
    if (parsedJson) {
      return parsedJson;
    }

    // Original fallback if JSON parsing completely fails
    console.warn("GeminiService: Using basic fallback for parsing AI response as JSON failed.");
    const fallbackIntent = this.extractAnalysisIntent(aiResponse, dataset);
    return {
      explanation: aiResponse, // Use raw response as explanation
      analysis: fallbackIntent.analysis,
      visualization: fallbackIntent.visualization,
      suggestions: this.generateSuggestions(dataset), // Generic suggestions
    };
  }


  private extractAnalysisIntent(response: string, dataset: Dataset): {
    analysis?: any;
    visualization?: any;
  } {
    const lowerResponse = response.toLowerCase();
    const numericColumns = this.getNumericColumns(dataset);
    const allColumns = dataset.columns;

    // This is a very basic keyword matching, ideally Gemini provides the structured JSON.
    if (lowerResponse.includes('correlation') || lowerResponse.includes('relationship')) {
      if (numericColumns.length >= 2) {
        return {
          analysis: { type: 'correlation', columns: numericColumns.slice(0, 2) },
          visualization: { type: 'scatter', title: `Correlation between ${numericColumns[0]} and ${numericColumns[1]}`, description: 'Scatter plot showing the relationship', x_axis: numericColumns[0], y_axis: numericColumns[1] },
        };
      }
    }
    if (lowerResponse.includes('distribution') || lowerResponse.includes('histogram')) {
      if (numericColumns.length > 0) {
        return {
          analysis: { type: 'histogram', columns: [numericColumns[0]] },
          visualization: { type: 'histogram', title: `Distribution of ${numericColumns[0]}`, description: 'Histogram showing value distribution', x_axis: numericColumns[0] },
        };
      }
    }
    if (lowerResponse.includes('frequency') || lowerResponse.includes('count')) {
      // Try to find a categorical column if possible for frequency
      const categoricalColumn = dataset.columns.find(col => this.inferColumnType(dataset, col) === 'categorical') || allColumns[0];
      return {
        analysis: { type: 'frequency', columns: [categoricalColumn] },
        visualization: { type: 'bar', title: `Frequency of ${categoricalColumn}`, description: 'Bar chart of frequency distribution', x_axis: categoricalColumn },
      };
    }
    if (lowerResponse.includes('summary') || lowerResponse.includes('overview') || lowerResponse.includes('describe')) {
      return { analysis: { type: 'summary', columns: dataset.columns } }; // Analyze all columns for summary
    }
    // Fallback to descriptive for a numeric column if general analysis is asked
    if (numericColumns.length > 0 && (lowerResponse.includes("analyze") || lowerResponse.includes("what about"))) {
      return { analysis: { type: 'descriptive', columns: [numericColumns[0]] } };
    }
    return {};
  }

  private inferColumnType(dataset: Dataset, columnName: string): string {
    const values = dataset.rows.map(row => row[columnName]).filter(val => val !== null && val !== undefined && String(val).trim() !== '');
    if (values.length === 0) return 'unknown';

    // Check a sample of values, not just the first one
    const sampleSize = Math.min(values.length, 20);
    let numericCount = 0;
    let dateCount = 0;
    let booleanCount = 0;

    for (let i = 0; i < sampleSize; i++) {
        const value = values[i];
        if (typeof value === 'number' && isFinite(value)) {
            numericCount++;
        } else if (typeof value === 'boolean') {
            booleanCount++;
        } else if (typeof value === 'string') {
            if (!isNaN(Number(value)) && isFinite(Number(value))) { // String that is a number
                 // Heuristic: if it contains non-digits beyond a decimal point, might be categorical ID
                if (!value.includes('.') || value.split('.')[1].length <= 4) numericCount++;
            }
            if (!isNaN(Date.parse(value))) { // String that is a date
                dateCount++;
            }
        }
    }

    if (numericCount / sampleSize > 0.7) return 'numeric'; // Majority numeric
    if (dateCount / sampleSize > 0.7) return 'date'; // Majority date
    if (booleanCount / sampleSize > 0.7) return 'boolean'; // Majority boolean

    // If first value was a number but not majority, it could be a numeric categorical
    if (typeof values[0] === 'number' && numericCount / sampleSize <= 0.7) return 'categorical_numeric';


    return 'categorical';
  }


  private getNumericColumns(dataset: Dataset): string[] {
    return dataset.columns.filter(col => this.inferColumnType(dataset, col) === 'numeric');
  }

  private generateSuggestions(dataset: Dataset): string[] {
    const suggestions: string[] = [];
    const numericColumns = this.getNumericColumns(dataset);
    const categoricalColumns = dataset.columns.filter(col => this.inferColumnType(dataset, col) === 'categorical' || this.inferColumnType(dataset, col) === 'categorical_numeric');


    if (numericColumns.length > 0) {
      suggestions.push(`Show descriptive statistics for ${numericColumns[0]}.`);
      suggestions.push(`What is the distribution of ${numericColumns[0]}?`);
    }
    if (numericColumns.length >= 2) {
      suggestions.push(`Explore the correlation between ${numericColumns[0]} and ${numericColumns[1]}.`);
    }
    if (categoricalColumns.length > 0) {
        suggestions.push(`Show frequency counts for ${categoricalColumns[0]}.`);
    }
    if (numericColumns.length > 0 && categoricalColumns.length > 0) {
        suggestions.push(`Compare ${numericColumns[0]} across different categories of ${categoricalColumns[0]}.`);
    }
    suggestions.push('What are the key insights from this dataset?');
    return suggestions.slice(0, 3); // Limit to 3 suggestions
  }

  private async performAnalysis(analysis: any, dataset: Dataset): Promise<any | null> {
    // Returns structured data from DataAnalyzer, not a formatted string
    if (!analysis || !analysis.type || !analysis.columns) {
      console.warn("GeminiService: performAnalysis called with invalid analysis object", analysis);
      return null;
    }

    const { type, columns, parameters } = analysis; // parameters might be used for t-test, etc.
    // Dynamically import DataAnalyzer to avoid circular dependencies if any, and it's a service.
    const dataAnalyzerModule = await import('../services/dataAnalyzer');
    const dataAnalyzer = dataAnalyzerModule.DataAnalyzer.getInstance();

    try {
      let results: any = null;
      switch (type.toLowerCase()) { // Ensure type matching is case-insensitive
        case 'descriptive':
          if (!columns || columns.length === 0) { // Descriptive can be for multiple columns if summary isn't used
             console.warn("GeminiService: Descriptive analysis called without columns, defaulting to summary.");
             results = await dataAnalyzer.getSummaryStatistics(dataset);
          } else {
            // If DataAnalyzer.calculateDescriptiveStats expects one column, and Gemini might send more
            // We might need a loop or pick the first one. For now, assume it handles an array or we send one.
            // Let's assume for now `calculateDescriptiveStats` is for a single column as per DataAnalyzer's current structure
            // and Gemini should ideally send one for "descriptive" unless it's a "summary" type.
            if (columns.length === 1) {
                 results = await dataAnalyzer.calculateDescriptiveStats(dataset, columns[0]);
            } else {
                // If multiple columns for descriptive, maybe it means summary of those?
                // This part needs alignment between Gemini's output and DataAnalyzer's capability.
                // For now, if multiple, do summary for dataset or first column.
                console.warn(`GeminiService: Descriptive analysis called with ${columns.length} columns. Performing for first or summary.`);
                results = await dataAnalyzer.calculateDescriptiveStats(dataset, columns[0]); // Or getSummaryStatistics(dataset, columns) if it exists
            }
          }
          break;
        case 'correlation':
          if (!columns || columns.length < 2) {
            console.warn("GeminiService: Correlation analysis requires at least two columns."); return null;
          }
          results = await dataAnalyzer.calculateCorrelation(dataset, columns[0], columns[1]);
          break;
        case 'frequency':
          if (!columns || columns.length !== 1) {
            console.warn("GeminiService: Frequency analysis requires exactly one column."); return null;
          }
          results = await dataAnalyzer.generateFrequencyDistribution(dataset, columns[0]);
          break;
        case 'histogram':
          if (!columns || columns.length !== 1) {
            console.warn("GeminiService: Histogram analysis requires exactly one column."); return null;
          }
          results = await dataAnalyzer.generateHistogram(dataset, columns[0], parameters?.bins); // pass bins if provided
          break;
        case 'scatter': // Assuming DataAnalyzer has generateScatterPlot
          if (!columns || columns.length < 2) {
            console.warn("GeminiService: Scatter plot requires at least two columns."); return null;
          }
          results = await dataAnalyzer.generateScatterPlot(dataset, columns[0], columns[1]);
          break;
        case 'summary':
          results = await dataAnalyzer.getSummaryStatistics(dataset); // Potentially pass specific columns if Gemini sends them
          break;
        case 't-test':
          if (!parameters || !parameters.groupColumn || !parameters.valueColumn) {
            console.warn("GeminiService: T-test requires groupColumn and valueColumn parameters.");
            return { error: "T-test requires groupColumn and valueColumn parameters. Please specify them." };
          }
          results = await dataAnalyzer.performIndependentTTest(dataset, parameters.groupColumn, parameters.valueColumn);
          break;
        case 'chi-squared': // Route general chi-squared to the existing post-hoc one for now
        case 'chi-squared with post-hoc analysis':
             // This method expects columns for the contingency table factors.
             // Gemini might send these in `columns` or detail them in `parameters`.
             // The current `performChiSquaredWithPostHoc` uses `columns[0]` as hospitalizationColumn
             // and `columns.slice(1)` as otherColumns. This needs alignment with Gemini's typical output for chi-squared.
             // For now, assume Gemini sends appropriate columns in the `columns` array.
             if (!columns || columns.length < 2) {
                 console.warn("GeminiService: Chi-squared test requires at least two columns for contingency table.");
                 return { error: "Chi-squared test requires at least two columns." };
             }
             results = await this.performChiSquaredWithPostHoc(dataset, columns, parameters);
             break;
        case 'kaplan-meier': // Already exists in performAnalysis, ensure it's callable
             if (!columns || columns.length !== 2) {
                 console.warn("GeminiService: Kaplan-Meier analysis requires two columns (timeToEvent, eventOccurred).");
                 return { error: "Kaplan-Meier analysis requires two columns (timeToEvent, eventOccurred)." };
             }
             const timeToEvent = dataset.rows.map(row => row[columns[0]]).filter(val => val !== null && typeof val === 'number') as number[];
             const eventOccurred = dataset.rows.map(row => row[columns[1]]).filter(val => val !== null && typeof val === 'boolean') as boolean[];
             results = await dataAnalyzer.calculateKaplanMeier(timeToEvent, eventOccurred);
             break;
         case 'chi-squared with post-hoc analysis': // Already exists
             results = await this.performChiSquaredWithPostHoc(dataset, columns, parameters); // Keep as is if it's special
             break;

        default:
          console.warn(`GeminiService: Unknown analysis type requested: ${type}`);
          return null;
      }
      return results; // Return the structured results
    } catch (error) {
      console.error(`GeminiService: Error during performAnalysis for type ${type}:`, error);
      // Return a structured error object or throw, depending on how frontend handles it
      return { error: `Error performing analysis: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  // ----- CHI-SQUARED (WITH TYPE FIXES) ----- // This can be moved to DataAnalyzer
  private async performChiSquaredWithPostHoc(
    dataset: Dataset,
    columns: string[],
    parameters: any
  ): Promise<any> {
    if (columns.length < 2) {
      return null;
    }

    const hospitalizationColumn = columns[0];
    const otherColumns = columns.slice(1);

    // Create a contingency table
    const contingencyTable: Record<string, Record<string, number>> = {};

    dataset.rows.forEach(row => {
      const hospitalizationStatus = row[hospitalizationColumn];
      if (hospitalizationStatus === null || hospitalizationStatus === undefined) return;

      const key = otherColumns.map(col => row[col]).join('-');
      if (!contingencyTable[key]) {
        contingencyTable[key] = {
          [String(hospitalizationStatus)]: 1,
        };
      } else {
        contingencyTable[key][String(hospitalizationStatus)] =
          (contingencyTable[key][String(hospitalizationStatus)] || 0) + 1;
      }
    });

    // Prepare observed array for chi-squared test: number[][]
    const observed: number[][] = Object.values(contingencyTable).map(row =>
      Object.values(row).map(Number)
    );

    // Dynamically import and declare module for chi2 test
    // @ts-ignore: type declaration
    const chi2test = await import('@stdlib/stats-chisqtest');
    const opts = { correct: true };
    const out = chi2test.factory(observed, opts);

    if (out.rejected) {
      console.log('Null hypothesis rejected: dependency.');
    } else {
      console.log('Failed to reject the null hypothesis: no dependency.');
    }

    // Post-hoc analysis (not implemented)
    // TODO: Implement detailed residual analysis if required

    return {
      chi2: out,
      contingencyTable: contingencyTable,
    };
  }
}
