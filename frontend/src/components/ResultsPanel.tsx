import React from 'react';
import { AlertTriangle, BarChartBig, MessageCircleQuestion, Sigma } from 'lucide-react'; // Icons, added MessageCircleQuestion
import { DescriptiveStats, CorrelationResult, TTestResult, StatisticalResult } from '../../../backend/types/analysis'; // Adjust path as needed

interface ResultsPanelProps {
  datasetId: string; // Currently unused, but might be useful later
  analysisResults: any | null;
}

// Helper to format numbers nicely
const formatNumber = (num: number | undefined | null, precision = 2): string => {
  if (num === undefined || num === null || isNaN(num)) return 'N/A';
  return num.toFixed(precision);
};

const ResultsPanel: React.FC<ResultsPanelProps> = ({ analysisResults }) => {
  if (!analysisResults) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <BarChartBig className="w-16 h-16 text-gray-400 dark:text-gray-500 mb-4" />
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Analysis Results</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Results from your AI-driven analysis will appear here.
        </p>
      </div>
    );
  }

  if (analysisResults.error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center text-red-600 dark:text-red-400">
        <AlertTriangle className="w-16 h-16 mb-4" />
        <h3 className="text-lg font-semibold">Analysis Error</h3>
        <p className="text-sm">{analysisResults.error}</p>
      </div>
    );
  }

  // Determine the type of result to render
  // This is a bit heuristic as `analysisResults` can be directly one of the *Result types
  // or it can be a StatisticalResult wrapping one of those (e.g. for frequency, histogram from DataAnalyzer)

  let resultType = analysisResults.type || 'unknown'; // 'type' field from StatisticalResult
  let dataToDisplay = analysisResults.data || analysisResults; // data field from StatisticalResult or the result itself
  let title = analysisResults.title || 'Analysis Results';

  // More specific type checking if not a generic StatisticalResult
  if (typeof dataToDisplay.coefficient === 'number' && dataToDisplay.variable1) resultType = 'correlation';
  if (dataToDisplay.testType === 'Independent Samples T-Test') resultType = 't-test';
  // Check for single descriptive statistics object (not an array)
  if (dataToDisplay.column && typeof dataToDisplay.mean === 'number' && !Array.isArray(dataToDisplay)) resultType = 'descriptiveStats';
  if (Array.isArray(dataToDisplay) && dataToDisplay.every((item: any) => item.column && typeof item.mean === 'number')) {
    resultType = 'summaryStats';
    title = analysisResults.title || 'Summary Statistics';
  }

  const handleAskAIAboutResult = (resultData: any, resultTypeName: string) => {
    const event = new CustomEvent('askAboutResult', {
      detail: {
        result: resultData,
        resultType: resultTypeName,
      },
    });
    window.dispatchEvent(event);
  };

  const AskAIButton: React.FC<{resultData: any, resultTypeName: string}> = ({resultData, resultTypeName}) => (
    <button
        onClick={() => handleAskAIAboutResult(resultData, resultTypeName)}
        className="mt-3 flex items-center text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-500 transition-colors"
    >
        <MessageCircleQuestion size={14} className="mr-1.5" />
        Ask AI to explain these results
    </button>
  );

  const renderDescriptiveStats = (stats: DescriptiveStats, isSummaryItem: boolean = false) => (
    <div className={`p-4 border dark:border-gray-700 rounded-lg ${isSummaryItem ? 'mb-0' : 'mb-4'}`}>
      <h4 className="text-md font-semibold text-blue-600 dark:text-blue-400 mb-2">
        Descriptive Statistics for: {stats.column}
      </h4>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <li>Count: {formatNumber(stats.count, 0)}</li>
        <li>Mean: {formatNumber(stats.mean)}</li>
        <li>Median: {formatNumber(stats.median)}</li>
        <li>Mode: {stats.mode ?? 'N/A'}</li>
        <li>Std Dev: {formatNumber(stats.standardDeviation)}</li>
        <li>Variance: {formatNumber(stats.variance)}</li>
        <li>Min: {formatNumber(stats.min)}</li>
        <li>Max: {formatNumber(stats.max)}</li>
        {stats.quartiles && (
          <>
            <li>Q1: {formatNumber(stats.quartiles.q1)}</li>
            <li>Q3: {formatNumber(stats.quartiles.q3)}</li>
          </>
        )}
      </ul>
      {!isSummaryItem && <AskAIButton resultData={stats} resultTypeName="Descriptive Statistics" />}
    </div>
  );

  const renderCorrelationResult = (corr: CorrelationResult) => (
     <div className="p-4 border dark:border-gray-700 rounded-lg">
      <h4 className="text-md font-semibold text-green-600 dark:text-green-400 mb-2">
        Correlation: {corr.variable1} & {corr.variable2}
      </h4>
      <p className="text-sm">Pearson's r: <span className="font-bold">{formatNumber(corr.coefficient, 3)}</span></p>
       {corr.pValue !== undefined && <p className="text-sm">P-value: <span className="font-bold">{formatNumber(corr.pValue, 4)}</span></p>}
       <p className="text-xs mt-1 italic">{corr.interpretation || "A measure of linear correlation between two sets of data."}</p>
       <AskAIButton resultData={corr} resultTypeName="Correlation Result" />
    </div>
  );

  const renderTTestResult = (ttest: TTestResult) => (
    <div className="p-4 border dark:border-gray-700 rounded-lg">
      <h4 className="text-md font-semibold text-purple-600 dark:text-purple-400 mb-2">{ttest.testType}</h4>
      <p className="text-sm mb-1">Comparing <span className="font-medium">{analysisResults.valueColumnForTTest /* This field needs to be passed in analysisResults */ || 'selected variable'}</span> between groups:</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-2">
        <div><strong>Group 1:</strong> {ttest.group1Name}</div>
        <div><strong>Group 2:</strong> {ttest.group2Name}</div>
        <div>Mean: {formatNumber(ttest.group1Mean)}</div>
        <div>Mean: {formatNumber(ttest.group2Mean)}</div>
        <div>Variance: {formatNumber(ttest.group1Variance)}</div>
        <div>Variance: {formatNumber(ttest.group2Variance)}</div>
        <div>N: {ttest.group1Size}</div>
        <div>N: {ttest.group2Size}</div>
      </div>
      <p className="text-sm">T-Statistic: <span className="font-bold">{formatNumber(ttest.tStatistic, 3)}</span></p>
      <p className="text-sm">Degrees of Freedom: <span className="font-bold">{ttest.degreesOfFreedom}</span></p>
      {ttest.pValue !== undefined && <p className="text-sm">P-value: <span className="font-bold">{formatNumber(ttest.pValue, 4)}</span></p>}
      {ttest.interpretation && <p className="text-xs mt-2 italic">{ttest.interpretation}</p>}
      <AskAIButton resultData={ttest} resultTypeName="T-Test Result" />
    </div>
  );

  const renderFrequencyDistribution = (freqDataWrapper: StatisticalResult) => (
    <div className="p-4 border dark:border-gray-700 rounded-lg">
        <h4 className="text-md font-semibold text-indigo-600 dark:text-indigo-400 mb-2">{freqDataWrapper.title || "Frequency Distribution"}</h4>
        <div className="max-h-60 overflow-y-auto text-sm">
            <table className="min-w-full">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700">
                    <tr>
                        <th className="py-2 px-3 text-left font-medium">Value</th>
                        <th className="py-2 px-3 text-left font-medium">Count</th>
                    </tr>
                </thead>
                <tbody>
                    {Object.entries(freqDataWrapper.data).map(([value, count]) => (
                        <tr key={value} className="border-b dark:border-gray-600 last:border-b-0">
                            <td className="py-1.5 px-3">{value}</td>
                            <td className="py-1.5 px-3">{String(count)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        <AskAIButton resultData={freqDataWrapper} resultTypeName="Frequency Distribution" />
    </div>
  );

  const renderHistogramData = (histDataWrapper: StatisticalResult) => (
     <div className="p-4 border dark:border-gray-700 rounded-lg">
        <h4 className="text-md font-semibold text-teal-600 dark:text-teal-400 mb-2">{histDataWrapper.title || "Histogram Data"}</h4>
         <div className="max-h-60 overflow-y-auto text-sm">
            <table className="min-w-full">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700">
                    <tr>
                        <th className="py-2 px-3 text-left font-medium">Range</th>
                        <th className="py-2 px-3 text-left font-medium">Count</th>
                    </tr>
                </thead>
                <tbody>
                    {(histDataWrapper.data as Array<{range: string, count: number}>).map((bin, index) => (
                        <tr key={index} className="border-b dark:border-gray-600 last:border-b-0">
                            <td className="py-1.5 px-3">{bin.range}</td>
                            <td className="py-1.5 px-3">{bin.count}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        <AskAIButton resultData={histDataWrapper} resultTypeName="Histogram Data" />
    </div>
  );


  const renderContent = () => {
    switch (resultType) {
      case 'descriptiveStats':
        return renderDescriptiveStats(dataToDisplay as DescriptiveStats);
      case 'summaryStats': // For array of DescriptiveStats
        return (
            <>
                {(dataToDisplay as DescriptiveStats[]).map((stats, index) => (
                    <div key={index} className="mb-3">{renderDescriptiveStats(stats)}</div>
                ))}
            </>
        );
      case 'correlation':
        return renderCorrelationResult(dataToDisplay as CorrelationResult);
      case 't-test':
        // DataAnalyzer's performIndependentTTest returns TTestResult directly, so dataToDisplay is TTestResult
        return renderTTestResult(dataToDisplay as TTestResult);
      case 'frequency': // This comes from a StatisticalResult where data is the frequency map
         return renderFrequencyDistribution(analysisResults as StatisticalResult); // Pass the whole StatisticalResult
      case 'histogram': // This comes from a StatisticalResult where data is histogram bins
         return renderHistogramData(analysisResults as StatisticalResult); // Pass the whole StatisticalResult
      default:
        // Attempt to render generic data if type is unknown or structure is simple
        if (typeof dataToDisplay === 'object' && dataToDisplay !== null) {
          return (
            <div className="p-4 border dark:border-gray-700 rounded-lg">
              <h4 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {title}
              </h4>
              <pre className="text-xs bg-gray-50 dark:bg-gray-900 p-3 rounded overflow-x-auto">
                {JSON.stringify(dataToDisplay, null, 2)}
              </pre>
            </div>
          );
        }
        return <p className="text-sm text-gray-600 dark:text-gray-400">Unsupported result type or structure.</p>;
    }
  };

  return (
    <div className="p-1 h-full overflow-y-auto">
      <div className="sticky top-0 bg-white dark:bg-gray-800 py-3 mb-3 z-10 -mx-4 px-4 border-b dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center">
          <Sigma size={20} className="mr-2 text-blue-500" />
          Analysis Results
        </h3>
      </div>
      <div className="space-y-4">
        {renderContent()}
      </div>
    </div>
  );
};

export default ResultsPanel;