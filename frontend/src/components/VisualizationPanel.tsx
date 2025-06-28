import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, ScatterChart, Scatter as ScatterPlot, PieChart, Pie, Cell, ComposedChart } from 'recharts';
import { BarChart3, TrendingUp, PieChart as PieIcon, Activity, Play } from 'lucide-react';

interface VisualizationPanelProps {
  datasetId: string;
}

interface AnalysisResult {
  type: 'descriptive' | 'correlation' | 'frequency' | 'histogram' | 'scatter' | 'summary' | 'kaplan-meier' | 'correlationMatrix';
  title: string;
  description: string;
  data: any;
  visualization?: {
    type: 'bar' | 'line' | 'scatter' | 'histogram' | 'pie';
    title: string;
    description: string;
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

const VisualizationPanel: React.FC<VisualizationPanelProps> = ({ datasetId }) => {
  const [selectedAnalysis, setSelectedAnalysis] = useState<'frequency' | 'histogram' | 'correlation' | 'scatter' | 'summary' | 'kaplan-meier' | 'correlationMatrix'>('frequency');
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [selectedColumn2, setSelectedColumn2] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  // Fetch dataset details
  const { data: dataset } = useQuery<DatasetDetails>({
    queryKey: ['dataset', datasetId],
    queryFn: async () => {
      const response = await fetch(`/api/upload/datasets/${datasetId}`);
      if (!response.ok) throw new Error('Failed to fetch dataset');
      const result = await response.json();
      return result.data;
    },
  });

  // Analysis mutation
  const analysisMutation = useMutation({
    mutationFn: async ({ type, params }: { type: string; params: any }): Promise<AnalysisResult> => {
      let url = '';
      let options: RequestInit = { method: 'POST', headers: { 'Content-Type': 'application/json' } };

      switch (type) {
        case 'frequency':
          url = `/api/analysis/frequency/${datasetId}/${params.column}`;
          break;
        case 'histogram':
          url = `/api/analysis/histogram/${datasetId}/${params.column}`;
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
          options.method = 'POST';
          delete options.body;
          break;
      }

      const response = await fetch(url, options);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Analysis failed');
      }
      const result = await response.json();
      return result.data;
    },
    onSuccess: (data) => {
      setAnalysisResult(data);
    },
  });

  const handleRunAnalysis = () => {
    if (!dataset) return;

    let params: any = {};

    switch (selectedAnalysis) {
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

    analysisMutation.mutate({ type: selectedAnalysis, params });
  };

  const renderVisualization = () => {
    if (!analysisResult) return null;

    const { data, visualization } = analysisResult;

    switch (visualization?.type || analysisResult.type) {
      case 'bar':
      case 'frequency':
        if (Array.isArray(data)) {
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
    return dataset?.columnInfo.filter(col => col.type === 'number').map(col => col.name) || [];
  };

  const getBooleanColumns = () => {
    return dataset?.columnInfo.filter(col => col.type === 'boolean').map(col => col.name) || [];
  };

  const getAllColumns = () => {
    return dataset?.columns || [];
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
              value={selectedAnalysis}
              onChange={(e) => setSelectedAnalysis(e.target.value as any)}
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
          {(selectedAnalysis === 'frequency' || selectedAnalysis === 'histogram' || selectedAnalysis === 'correlation' || selectedAnalysis === 'scatter' || selectedAnalysis === 'kaplan-meier') && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                {selectedAnalysis === 'frequency' ? 'Column' :
                 selectedAnalysis === 'histogram' ? 'Numeric Column' :
                 selectedAnalysis === 'scatter' ? 'X-Axis Column' :
                 selectedAnalysis === 'kaplan-meier' ? 'Time to Event Column' : 'First Column'}
              </label>
              <select
                value={selectedColumn}
                onChange={(e) => setSelectedColumn(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select column...</option>
                {(selectedAnalysis === 'histogram' || selectedAnalysis === 'kaplan-meier' ? getNumericColumns() : getAllColumns()).map(col => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>
          )}

          {/* Column 2 */}
          {(selectedAnalysis === 'correlation' || selectedAnalysis === 'scatter' || selectedAnalysis === 'kaplan-meier') && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                {selectedAnalysis === 'scatter' ? 'Y-Axis Column' :
                 selectedAnalysis === 'kaplan-meier' ? 'Event Occurred Column' : 'Second Column'}
              </label>
              <select
                value={selectedColumn2}
                onChange={(e) => setSelectedColumn2(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select column...</option>
                {(selectedAnalysis === 'kaplan-meier' ? getBooleanColumns() : getNumericColumns()).map(col => (
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
                (selectedAnalysis !== 'summary' && !selectedColumn) ||
                ((selectedAnalysis === 'correlation' || selectedAnalysis === 'scatter' || selectedAnalysis === 'kaplan-meier') && !selectedColumn2) ||
                (selectedAnalysis === 'correlationMatrix')
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
      {analysisResult && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center space-x-3 mb-4">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {analysisResult.title}
            </h3>
          </div>

          <p className="text-gray-600 mb-6">
            {analysisResult.description}
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
                {JSON.stringify(analysisResult.data, null, 2)}
              </pre>
            </div>
          </details>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => {
            setSelectedAnalysis('summary');
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
          onClick={() => setSelectedAnalysis('frequency')}
          className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow text-left"
        >
          <BarChart3 className="w-8 h-8 text-green-600 mb-2" />
          <h3 className="font-medium text-gray-900">Frequency</h3>
          <p className="text-sm text-gray-600">
            Distribution of categorical values
          </p>
        </button>

        <button
          onClick={() => setSelectedAnalysis('histogram')}
          className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow text-left"
        >
          <Activity className="w-8 h-8 text-purple-600 mb-2" />
          <h3 className="font-medium text-gray-900">Histogram</h3>
          <p className="text-sm text-gray-600">
            Distribution of numeric values
          </p>
        </button>

        <button
          onClick={() => setSelectedAnalysis('scatter')}
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
