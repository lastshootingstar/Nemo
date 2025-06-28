import React, { useState, useEffect } from 'react'; // Added useEffect
import { useMutation, useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, ScatterChart, Scatter as ScatterPlot, PieChart, Pie, Cell, ComposedChart } from 'recharts';
import { BarChart3, TrendingUp, PieChart as PieIcon, Activity, Play, HelpCircle, AlertTriangle, Loader2 } from 'lucide-react'; // Added HelpCircle

// This interface should align with the `visualizationConfig` from App.tsx (originally from GeminiService/DataAnalyzer)
interface VisualizationConfig {
  type: string; // 'bar' | 'line' | 'scatter' | 'histogram' | 'pie' | 'boxplot'; // Match Gemini's suggestions
  title?: string;
  description?: string;
  x_axis?: string; // Column name for x-axis
  y_axis?: string; // Column name for y-axis
  data?: any[];    // Data for the chart, specific to the type
  // Potentially add other fields Gemini might suggest or DataAnalyzer provides
  columns?: string[]; // e.g. for histogram, the column to analyze
}


interface VisualizationPanelProps {
  datasetId: string;
  visualizationConfig: VisualizationConfig | null; // New prop from App.tsx
}

interface AnalysisResult { // This is for results from its own API calls
  type: string; //'descriptive' | 'correlation' | 'frequency' | 'histogram' | 'scatter' | 'summary' | 'kaplan-meier' | 'correlationMatrix';
  title: string;
  description: string;
  data: any;
  visualization?: {
    type: string; //'bar' | 'line' | 'scatter' | 'histogram' | 'pie' | 'correlationMatrix';
    title: string;
    description: string;
    xAxis?: string;
    yAxis?: string;
  };
}

interface DatasetDetails {
  columns: string[];
  columnInfo: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'date';
  }>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const VisualizationPanel: React.FC<VisualizationPanelProps> = ({ datasetId, visualizationConfig }) => {
  console.log('VisualizationPanel props:', { datasetId, visualizationConfig });
  const [selectedAnalysisType, setSelectedAnalysisType] = useState<'frequency' | 'histogram' | 'correlation' | 'scatter' | 'summary' | 'kaplan-meier' | 'correlationMatrix'>('frequency');
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [selectedColumn2, setSelectedColumn2] = useState<string>('');

  // This state will hold the actual data/config used by renderVisualization
  // It can be populated by `visualizationConfig` prop or by internal analysis results
  const [currentChartDisplay, setCurrentChartDisplay] = useState<{
    type: string; // e.g., 'bar', 'histogram', 'scatter', 'kaplan-meier', 'correlationMatrix'
    data: any;
    title?: string;
    description?: string;
    xAxisKey?: string; // Specific for recharts
    yAxisKey?: string; // Specific for recharts
    dataKey?: string; // Specific for recharts (e.g. for Bar's dataKey)
  } | null>(null);

    // Fetch dataset details (for column selectors)
    const { data: datasetDetails, isLoading: isLoadingDatasetDetails } = useQuery<DatasetDetails>({
      queryKey: ['datasetDetailsForViz', datasetId], // Unique query key
      queryFn: async () => {
        const response = await fetch(`/api/upload/datasets/${datasetId}`);
        if (!response.ok) throw new Error('Failed to fetch dataset details for visualization panel');
        const result = await response.json();
        return result.data;
      },
      enabled: !!datasetId, // Only run if datasetId is present
    });

  // Local state for results from panel's own analysis triggers
  // const [internalAnalysisResult, setInternalAnalysisResult] = useState<AnalysisResult | null>(null); // Replaced by currentChartDisplay for rendering


  // Effect to update chart when visualizationConfig prop changes (from AI Chat)
  useEffect(() => {
    if (visualizationConfig) {
      // console.log("VisualizationPanel: Received new visualizationConfig prop:", visualizationConfig);

      // If visualizationConfig from Gemini/Chat has chart-ready data from DataAnalyzer (via StatisticalResult.visualization.data)
      if (visualizationConfig.data && visualizationConfig.data.length > 0 && visualizationConfig.type) {
         setCurrentChartDisplay({
            type: visualizationConfig.type,
            data: visualizationConfig.data,
            title: visualizationConfig.title || 'AI Suggested Chart',
            description: visualizationConfig.description,
            xAxisKey: visualizationConfig.x_axis || (visualizationConfig.type === 'histogram' ? 'range' : 'value'),
            yAxisKey: visualizationConfig.y_axis || 'count', // Default yAxisKey for many charts
            dataKey: visualizationConfig.y_axis || (visualizationConfig.type === 'histogram' || visualizationConfig.type === 'frequency' || visualizationConfig.type === 'bar' ? 'count' : (visualizationConfig.type === 'kaplan-meier' ? 'survival' : 'value'))
        });
        // Optionally, update the panel's own selectors to match this AI suggestion
        if (visualizationConfig.type === 'histogram' || visualizationConfig.type === 'frequency' || visualizationConfig.type === 'bar' ) {
            if(visualizationConfig.x_axis && datasetDetails?.columns.includes(visualizationConfig.x_axis)) setSelectedColumn(visualizationConfig.x_axis);
            else if(visualizationConfig.columns && visualizationConfig.columns.length > 0 && datasetDetails?.columns.includes(visualizationConfig.columns[0])) setSelectedColumn(visualizationConfig.columns[0]);
            setSelectedAnalysisType(visualizationConfig.type as any);
        } else if (visualizationConfig.type === 'scatter' && visualizationConfig.x_axis && visualizationConfig.y_axis && datasetDetails && datasetDetails?.columns.includes(visualizationConfig.x_axis) && datasetDetails?.columns.includes(visualizationConfig.y_axis)) {
            setSelectedColumn(visualizationConfig.x_axis);
            setSelectedColumn2(visualizationConfig.y_axis);
            setSelectedAnalysisType('scatter');
        }
         // TODO: Add similar logic for other types like kaplan-meier if Gemini provides column names in visualizationConfig.columns

      } else if (visualizationConfig.type && visualizationConfig.columns && visualizationConfig.columns.length > 0) {
        // If config has type and columns, but no direct data, trigger an internal analysis
        const autoAnalysisType = visualizationConfig.type as any;

        let params: any = {};
        let canTrigger = false;
        const currentSelectedCol = visualizationConfig.columns[0];
        const currentSelectedCol2 = visualizationConfig.columns.length >= 2 ? visualizationConfig.columns[1] : '';


        if (autoAnalysisType === 'histogram' || autoAnalysisType === 'frequency' || autoAnalysisType === 'bar') {
            if(datasetDetails?.columns.includes(currentSelectedCol)) setSelectedColumn(currentSelectedCol);
            setSelectedAnalysisType(autoAnalysisType);
            params = { column: currentSelectedCol, bins: 10 };
            canTrigger = !!currentSelectedCol;
        } else if (((autoAnalysisType as string) === 'scatter' || (autoAnalysisType as string) === 'correlation') && currentSelectedCol && currentSelectedCol2) {
            if(datasetDetails?.columns.includes(currentSelectedCol)) setSelectedColumn(currentSelectedCol);
            if(datasetDetails?.columns.includes(currentSelectedCol2)) setSelectedColumn2(currentSelectedCol2);
            setSelectedAnalysisType(autoAnalysisType === 'correlation' ? 'correlation' : 'scatter');

            if (autoAnalysisType === 'correlation') {
                params = { column1: currentSelectedCol, column2: currentSelectedCol2 };
            } else { // scatter
                 params = { xColumn: currentSelectedCol, yColumn: currentSelectedCol2 };
            }
            canTrigger = true;
        }

        if (canTrigger) {
            // console.log(`VisualizationPanel: Triggering internal analysis for AI suggestion: ${autoAnalysisType} with params`, params);
             analysisMutation.mutate({ type: autoAnalysisType, params });
        } else {
            // console.log("VisualizationPanel: AI suggested config, but not enough to auto-trigger analysis or no direct data", visualizationConfig);
        }
      } else if (visualizationConfig.type === 'summary' || visualizationConfig.type === 'correlationMatrix') {
        // For types that don't require specific columns from Gemini to trigger
        setSelectedAnalysisType(visualizationConfig.type as any);
        analysisMutation.mutate({ type: visualizationConfig.type, params: {} });
      }
      else {
         // console.log("VisualizationPanel: Received AI config, but not plottable or actionable", visualizationConfig);
         // setCurrentChartDisplay(null); // Clear chart if AI suggestion is not usable
      }
    }
  }, [visualizationConfig, datasetId, datasetDetails]); // Added datasetDetails to ensure columns are available for setSelectedColumn


  // Analysis mutation (triggered by panel's own controls OR by useEffect from prop)
  const analysisMutation = useMutation({
    mutationFn: async ({ type, params }: { type: string; params: any }): Promise<AnalysisResult> => {
      let url = '';
      let options: RequestInit = { method: 'POST', headers: { 'Content-Type': 'application/json' } };

      // Ensure type is one of the expected values for the switch
      const validAnalysisType = type as typeof selectedAnalysisType;

      switch (validAnalysisType) {
        case 'frequency':
          url = `/api/analysis/frequency/${datasetId}/${params.column}`;
          options.method = 'GET';
          delete options.body;
          break;
        case 'histogram':
          url = `/api/analysis/histogram/${datasetId}/${params.column}`;
          options.method = 'POST';
          options.body = JSON.stringify({ bins: params.bins || 10 });
          break;
        case 'correlation':
          url = `/api/analysis/correlation/${datasetId}`;
          options.body = JSON.stringify({ column1: params.column1, column2: params.column2 });
          break;
        case 'scatter':
          url = `/api/analysis/scatter/${datasetId}`;
          options.body = JSON.stringify({ xColumn: params.xColumn, yColumn: params.yColumn });
          break;
        case 'summary':
          url = `/api/analysis/summary/${datasetId}`;
          options.method = 'GET';
          delete options.body;
          break;
        case 'kaplan-meier':
          url = `/api/analysis/kaplan-meier/${datasetId}`;
          options.body = JSON.stringify({ timeColumn: params.timeColumn, eventColumn: params.eventColumn });
          break;
        case 'correlationMatrix':
          url = `/api/analysis/correlation-matrix/${datasetId}`;
          options.method = 'GET';
          delete options.body;
          break;
        default:
          throw new Error(`Unsupported analysis type in mutation: ${type}`);
      }

      const response = await fetch(url, options);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({error: "Analysis request failed"}));
        throw new Error(errorData.error || 'Analysis failed');
      }
      const result = await response.json();
      if(!result.success) throw new Error(result.error || "Analysis API returned an error");
      return result.data;
    },
    onSuccess: (data) => {
      // setInternalAnalysisResult(data); // Not strictly needed if currentChartDisplay is source of truth
      setCurrentChartDisplay({
        type: data.visualization?.type || data.type,
        data: data.data, // This should be the plottable data from DataAnalyzer's StatisticalResult.data
        title: data.title,
        description: data.description,
        xAxisKey: data.visualization?.xAxis || (data.type === 'scatter' ? 'x' : (data.type === 'histogram' ? 'range' : 'value')),
        yAxisKey: data.visualization?.yAxis || (data.type === 'scatter' ? 'y' : 'count'),
        dataKey: data.visualization?.yAxis || ( (data.type as string) === 'histogram' || (data.type as string) === 'frequency' || (data.type as string) === 'bar' ? 'count' : ( (data.type as string) === 'kaplan-meier' ? 'survival' : 'value'))
      });
    },
    onError: (error: Error) => {
        console.error("Visualization Panel Analysis Error:", error);
        setCurrentChartDisplay({ // Show error in chart display area
            type: 'error',
            data: null,
            title: "Analysis Error",
            description: error.message
        });
    }
  });

  const handleRunAnalysis = () => {
    if (!datasetDetails) return; // Ensure datasetDetails is loaded

    let params: any = {};
    let analysisToRun = selectedAnalysisType; // Use the state for user-selected type

    switch (analysisToRun) {
      case 'frequency':
        if (!selectedColumn) return;
        params = { column: selectedColumn };
        break;
      case 'histogram':
        if (!selectedColumn) return;
        params = { column: selectedColumn, bins: 10 };
        break;
      case 'correlation':
        if (!selectedColumn || !selectedColumn2) return;
        params = { column1: selectedColumn, column2: selectedColumn2 };
        break;
      case 'scatter':
        if (!selectedColumn || !selectedColumn2) return;
        params = { xColumn: selectedColumn, yColumn: selectedColumn2 };
        break;
      case 'summary':
        params = {};
        break;
      case 'kaplan-meier':
        if (!selectedColumn || !selectedColumn2) return;
        params = { timeColumn: selectedColumn, eventColumn: selectedColumn2 };
        break;
      case 'correlationMatrix':
        params = {};
        break;
    }

    analysisMutation.mutate({ type: analysisToRun, params });
  };

  const renderVisualization = () => {
    // Now uses currentChartDisplay state
    if (!currentChartDisplay || (!currentChartDisplay.data && currentChartDisplay.type !== 'error')) {
      if (analysisMutation.isPending || isLoadingDatasetDetails) {
        return <div className="flex justify-center items-center h-40"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;
      }
       if (currentChartDisplay && currentChartDisplay.type === 'error') {
        return (
            <div className="p-4 text-center text-red-500 dark:text-red-400">
                <AlertTriangle className="w-10 h-10 mx-auto mb-2" />
                <p className="font-semibold">{currentChartDisplay.title}</p>
                <p className="text-sm">{currentChartDisplay.description}</p>
            </div>
        );
      }
      return (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <HelpCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            Select an analysis type and columns, then click "Run Analysis".
            Or, ask the AI to generate a visualization.
        </div>
      );
    }

    const { type, data, title, description, xAxisKey, yAxisKey, dataKey } = currentChartDisplay;
     if (type === 'error') { // Handle error display explicitly if data is null
        return (
            <div className="p-4 text-center text-red-500 dark:text-red-400">
                <AlertTriangle className="w-10 h-10 mx-auto mb-2" />
                <p className="font-semibold">{title || "Error"}</p>
                <p className="text-sm">{description}</p>
            </div>
        );
    }
    if (!data) return <p className="text-sm text-center text-gray-500">No data available for this visualization.</p>;


    switch (type) {
      case 'bar': // Handles frequency as well if data is {value: string, count: number}[]
      case 'frequency':
        if (Array.isArray(data)) {
          // Ensure data has 'value' and 'count' keys if that's what x/yAxisKey map to
          const chartData = data.map(item => ({ ...item, [xAxisKey || 'value']: item[xAxisKey || 'value'], [dataKey || 'count']: item[dataKey || 'count']}));
          return (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="value" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          );
        }
        break;

      case 'histogram':
        if (Array.isArray(data)) {
          return (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          );
        }
        break;

      case 'scatter':
        if (Array.isArray(data)) {
          return (
            <ResponsiveContainer width="100%" height={400}>
              <ScatterChart data={data}>
                <CartesianGrid />
                <XAxis dataKey="x" />
                <YAxis dataKey="y" />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <ScatterPlot fill="#8884d8" />
              </ScatterChart>
            </ResponsiveContainer>
          );
        }
        break;

      case 'pie':
        if (Array.isArray(data) && data.length <= 10) {
          return (
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          );
        }
        break;

      case 'kaplan-meier':
        if (Array.isArray(data)) {
          return (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="time" label={{ value: 'Time', position: 'insideBottomRight', offset: 0 }} />
                <YAxis type="number" dataKey="survival" label={{ value: 'Survival Probability', angle: -90, position: 'insideLeft' }} domain={[0, 1]} />
                <Tooltip />
                <Legend />
                <Line type="stepAfter" dataKey="survival" stroke="#8884d8" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          );
        }
        break;
      
      case 'correlationMatrix':
        if (typeof data === 'object' && data !== null) {
          // Convert the correlation matrix object to an array of objects suitable for recharts
          const matrixData: { column1: string; column2: string; correlation: number | null }[] = [];
          for (const column1 in data) {
            if (data.hasOwnProperty(column1)) {
              for (const column2 in data[column1]) {
                if (data[column1].hasOwnProperty(column2)) {
                  matrixData.push({
                    column1,
                    column2,
                    correlation: data[column1][column2]
                  });
                }
              }
            }
          }

          return (
            <ResponsiveContainer width="100%" height={400}>
              <ScatterChart>
                <CartesianGrid />
                <XAxis dataKey="column1" type="category" />
                <YAxis dataKey="column2" type="category" />
                <Tooltip />
                <ScatterPlot data={matrixData} fill="#8884d8" />
              </ScatterChart>
            </ResponsiveContainer>
          );
        }
        break;

      default:
        return (
          <div className="p-8 text-center">
            <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              Visualization not available for this analysis type
            </p>
          </div>
        );
    }

    return (
      <div className="p-8 text-center">
        <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">
          Unable to render visualization
        </p>
      </div>
    );
  };

  const getNumericColumns = () => {
    return datasetDetails?.columnInfo.filter(col => col.type === 'number').map(col => col.name) || [];
  };

  const getBooleanColumns = () => {
    return datasetDetails?.columnInfo.filter(col => col.type === 'boolean').map(col => col.name) || [];
  };

  const getAllColumns = () => {
    return datasetDetails?.columns || [];
  };

  return (
    <div className="space-y-6">
      {/* Analysis Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Generate Visualizations
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Analysis Type */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">
              Analysis Type
            </label>
            <select
              value={selectedAnalysisType}
              onChange={(e) => setSelectedAnalysisType(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="frequency">Frequency Distribution</option>
              <option value="histogram">Histogram</option>
              <option value="correlation">Correlation</option>
              <option value="scatter">Scatter Plot</option>
              <option value="summary">Summary Statistics</option>
              <option value="kaplan-meier">Kaplan-Meier Survival Analysis</option>
              <option value="correlationMatrix">Correlation Matrix</option>
            </select>
          </div>

          {/* Column 1 */}
          {(selectedAnalysisType === 'frequency' || selectedAnalysisType === 'histogram' || selectedAnalysisType === 'correlation' || selectedAnalysisType === 'scatter' || selectedAnalysisType === 'kaplan-meier') && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                {selectedAnalysisType === 'frequency' ? 'Column' :
                 selectedAnalysisType === 'histogram' ? 'Numeric Column' :
                 selectedAnalysisType === 'scatter' ? 'X-Axis Column' :
                 selectedAnalysisType === 'kaplan-meier' ? 'Time to Event Column' : 'First Column'}
              </label>
              <select
                value={selectedColumn}
                onChange={(e) => setSelectedColumn(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select column...</option>
                {(selectedAnalysisType === 'histogram' || selectedAnalysisType === 'kaplan-meier' ? getNumericColumns() : getAllColumns()).map(col => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>
          )}

          {/* Column 2 */}
          {(selectedAnalysisType === 'correlation' || selectedAnalysisType === 'scatter' || selectedAnalysisType === 'kaplan-meier') && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                {selectedAnalysisType === 'scatter' ? 'Y-Axis Column' :
                 selectedAnalysisType === 'kaplan-meier' ? 'Event Occurred Column' : 'Second Column'}
              </label>
              <select
                value={selectedColumn2}
                onChange={(e) => setSelectedColumn2(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select column...</option>
                {(selectedAnalysisType === 'kaplan-meier' ? getBooleanColumns() : getNumericColumns()).map(col => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>
          )}

          {/* Run Button */}
          <div className="flex items-end">
            <button
              onClick={handleRunAnalysis}
              disabled={analysisMutation.isPending ||
                (selectedAnalysisType !== 'summary' && !selectedColumn) ||
                ((selectedAnalysisType === 'correlation' || selectedAnalysisType === 'scatter' || selectedAnalysisType === 'kaplan-meier') && !selectedColumn2) ||
                (selectedAnalysisType === 'correlationMatrix' && (!datasetDetails?.columnInfo.some(col => col.type === 'number') || datasetDetails?.columnInfo.filter(col => col.type === 'number').length < 2))
              }
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Play className="w-4 h-4" />
              <span>{analysisMutation.isPending ? 'Running...' : 'Run Analysis'}</span>
            </button>
          </div>
        </div>

        {analysisMutation.error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-red-600 dark:text-red-400 text-sm">
              {analysisMutation.error.message}
            </p>
          </div>
        )}
      </div>

      {/* Results */}
      {currentChartDisplay && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center space-x-3 mb-4">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {currentChartDisplay.title}
            </h3>
          </div>

          <p className="text-gray-600 mb-6">
            {currentChartDisplay.description}
          </p>

          {/* Visualization */}
          <div className="mb-6">
            {renderVisualization()}
          </div>

          {/* Raw Data */}
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
              View Raw Data
            </summary>
            <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-md overflow-x-auto">
              <pre className="text-xs text-gray-600">
                {JSON.stringify(currentChartDisplay.data, null, 2)}
              </pre>
            </div>
          </details>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => {
            setSelectedAnalysisType('summary');
            analysisMutation.mutate({ type: 'summary', params: {} });
          }}
          className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow text-left"
        >
          <TrendingUp className="w-8 h-8 text-blue-600 mb-2" />
          <h3 className="font-medium text-gray-900">Summary Stats</h3>
          <p className="text-sm text-gray-600">
            Overview of all numeric columns
          </p>
        </button>

        <button
          onClick={() => setSelectedAnalysisType('frequency')}
          className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow text-left"
        >
          <BarChart3 className="w-8 h-8 text-green-600 mb-2" />
          <h3 className="font-medium text-gray-900">Frequency</h3>
          <p className="text-sm text-gray-600">
            Distribution of categorical values
          </p>
        </button>

        <button
          onClick={() => setSelectedAnalysisType('histogram')}
          className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow text-left"
        >
          <Activity className="w-8 h-8 text-purple-600 mb-2" />
          <h3 className="font-medium text-gray-900">Histogram</h3>
          <p className="text-sm text-gray-600">
            Distribution of numeric values
          </p>
        </button>

        <button
          onClick={() => setSelectedAnalysisType('scatter')}
          className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow text-left">
          <Activity className="w-8 h-8 text-orange-600 mb-2" />
          <h3 className="font-medium text-gray-900">Scatter Plot</h3>
          <p className="text-sm text-gray-600">
            Relationship between variables
          </p>
        </button>
      </div>
    </div>
  );
};

export default VisualizationPanel;
