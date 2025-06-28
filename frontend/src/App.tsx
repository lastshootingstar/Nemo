import React, { useState, useEffect } from 'react';
import DataUpload from './components/DataUpload';
import DataPreview from './components/DataPreview';
import ChatInterface from './components/ChatInterface';
import VisualizationPanel from './components/VisualizationPanel';
import ResultsPanel from './components/ResultsPanel';
import { Upload, Database, LayoutDashboard, BarChart3, FileUp, Info } from 'lucide-react'; // Added LayoutDashboard for Analysis tab

interface Dataset {
  id: string;
  name: string;
  fileName: string;
  uploadedAt: string;
  rows: number;
  columns: number;
}

type ActiveTabType = 'upload' | 'preview' | 'analysis';

function App() {
  const [currentDataset, setCurrentDataset] = useState<Dataset | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTabType>('upload');

  const [analysisResults, setAnalysisResults] = useState<any | null>(null);
  const [visualizationConfig, setVisualizationConfig] = useState<any | null>(null);

  const handleDatasetUploaded = (dataset: Dataset) => {
    setCurrentDataset(dataset);
    setAnalysisResults(null); // Reset results when new dataset is uploaded
    setVisualizationConfig(null);
    setActiveTab('preview'); // Switch to Data Preview tab after upload
  };

  const handleNewUploadClick = () => {
    setCurrentDataset(null);
    setAnalysisResults(null);
    setVisualizationConfig(null);
    setActiveTab('upload');
  };

  // Effect to listen for custom event from ChatInterface (within Analysis tab)
  useEffect(() => {
    const handleAnalysisComplete = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail) {
        setAnalysisResults(customEvent.detail.analysisResults);
        if (customEvent.detail.visualization) {
          setVisualizationConfig(customEvent.detail.visualization);
        } else if (customEvent.detail.analysisResults?.visualization) {
          setVisualizationConfig(customEvent.detail.analysisResults.visualization);
        }
      }
    };

    window.addEventListener('analysisComplete', handleAnalysisComplete);
    return () => {
      window.removeEventListener('analysisComplete', handleAnalysisComplete);
    };
  }, []);

  const appTabs = [
    { id: 'upload', label: 'Upload Data', icon: Upload, disabled: false },
    { id: 'preview', label: 'Data Preview', icon: Database, disabled: !currentDataset },
    { id: 'analysis', label: 'Analysis Workspace', icon: LayoutDashboard, disabled: !currentDataset },
  ];

  // Calculate header height for main content area
  const [headerHeight, setHeaderHeight] = useState(68); // Default or initial estimate
  const headerRef = React.useRef<HTMLElement>(null);

  useEffect(() => {
    if (headerRef.current) {
      setHeaderHeight(headerRef.current.offsetHeight);
    }
  }, [currentDataset]); // Re-calculate if header content changes (e.g. dataset name appears)


  return (
    <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Header */}
      <header ref={headerRef} className="bg-white dark:bg-gray-800 shadow-md border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-white" /> {/* Main App Icon */}
              </div>
              <div>
                <h1 className="text-2xl font-bold">NemoClinical</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">Advanced Data Analysis Platform</p>
              </div>
            </div>
            {currentDataset && (
              <div className="text-right">
                <p className="text-sm font-semibold">{currentDataset.name}</p>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  {currentDataset.rows} rows, {currentDataset.columns} columns
                </p>
              </div>
            )}
             {/* Conditionally show "Upload New" button or hide if on upload tab already */}
            {activeTab !== 'upload' && (
                <button
                    onClick={handleNewUploadClick}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                    <FileUp size={18}/>
                    <span>Upload New</span>
                </button>
            )}
          </div>
        </div>
        {/* Navigation Tabs */}
        <nav className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex space-x-4">
            {appTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => !tab.disabled && setActiveTab(tab.id as ActiveTabType)}
                  disabled={tab.disabled}
                  className={`
                    flex items-center space-x-2 py-3 px-3 border-b-2 font-medium text-sm transition-colors
                    ${isActive
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : tab.disabled
                      ? 'border-transparent text-gray-400 dark:text-gray-600 cursor-not-allowed'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      {/* Main Content Area based on activeTab */}
      <main
        className="flex-grow overflow-y-auto"
        style={{ height: `calc(100vh - ${headerHeight}px)`}}
      >
        {activeTab === 'upload' && (
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 flex items-center justify-center">
            <div className="w-full max-w-2xl">
                <DataUpload onDatasetUploaded={handleDatasetUploaded} />
            </div>
          </div>
        )}
        {activeTab === 'preview' && currentDataset && (
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <DataPreview datasetId={currentDataset.id} />
          </div>
        )}
        {activeTab === 'analysis' && currentDataset && (
          <div className="flex flex-row p-4 space-x-4 h-full">
            {/* Panel 1: Chat Interface */}
            <div className="flex-1 w-1/3 bg-white dark:bg-gray-800 shadow-lg rounded-lg overflow-hidden flex flex-col">
              <ChatInterface datasetId={currentDataset.id} />
            </div>
            {/* Panel 2: Results Panel */}
            <div className="flex-1 w-1/3 bg-white dark:bg-gray-800 shadow-lg rounded-lg overflow-y-auto p-4">
              <ResultsPanel datasetId={currentDataset.id} analysisResults={analysisResults} />
            </div>
            {/* Panel 3: Visualization Panel */}
            <div className="flex-1 w-1/3 bg-white dark:bg-gray-800 shadow-lg rounded-lg overflow-y-auto p-4">
              <VisualizationPanel datasetId={currentDataset.id} visualizationConfig={visualizationConfig} />
            </div>
          </div>
        )}
        {/* Placeholder for tabs that require a dataset but none is loaded */}
        {(activeTab === 'preview' || activeTab === 'analysis') && !currentDataset && (
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col items-center justify-center h-full">
                <Info size={48} className="text-yellow-500 mb-4"/>
                <h2 className="text-2xl font-semibold mb-2">No Dataset Loaded</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Please go to the 'Upload Data' tab to load a dataset.
                </p>
                <button
                    onClick={() => setActiveTab('upload')}
                    className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                    Go to Upload
                </button>
            </div>
        )}
      </main>
      <style jsx global>{`
        /* Simple scrollbar styling for webkit browsers */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
        /* For Firefox */
        * {
          scrollbar-width: thin;
          scrollbar-color: #888 #f1f1f1;
        }
      `}</style>
    </div>
  );
}

export default App;

