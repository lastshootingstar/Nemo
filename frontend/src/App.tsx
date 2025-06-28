import React, { useState, useEffect } from 'react';
import DataUpload from './components/DataUpload';
import DataPreview from './components/DataPreview';
import ChatInterface from './components/ChatInterface';
import VisualizationPanel from './components/VisualizationPanel';
import ResultsPanel from './components/ResultsPanel';
import { Upload, Database, LayoutDashboard, BarChart3, FileUp, Info } from 'lucide-react';

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

  // State for State faocrrdionrdion
  const [mobileOpen, setMobileOpen] = useState<'chat' | 'results' | 'visualization' | null>(null);
  // State for desktop inner tabs
  const [analysisSubTab, setAnalysisSubTab] = useState<'chat' | 'results' | 'visualization'>('chat');

  const handleDatasetUploaded = (dataset: Dataset) => {
    setCurrentDataset(dataset);
    setAnalysisResults(null);
    setActiveTab('preview');
  };

  const handleNewUploadClick = () => {
    setCurrentDataset(null);
    setAnalysisResults(null);
    setVisualizationConfig(null);
    setActiveTab('upload');
  };

  useEffect(() => {
    const handleAnalysisComplete = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail) {
        setAnalysisResults(customEvent.detail.analysisResults);
        setVisualizationConfig(customEvent.detail.visualization || customEvent.detail.analysisResults?.visualization
        );
      }
    };
    window.addEventListener('analysisComplete', handleAnalysisComplete);
    return () => window.removeEventListener('analysisComplete', handleAnalysisComplete);
  }, []);

  const appTabs = [
    { id: 'upload', label: 'Upload Data', icon: Upload, disabled: false },
    { id: 'preview', label: 'Data Preview', icon: Database, disabled: !currentDataset },
    { id: 'analysis', label: 'Analysis Workspace', icon: LayoutDashboard, disabled: !currentDataset },
  ];

  const [headerHeight, setHeaderHeight] = useState(68);
  const headerRef = React.useRef<HTMLElement>(null);
  useEffect(() => {
    if (headerRef.current) {
      setHeaderHeight(headerRef.current.offsetHeight);
    }
  }, [currentDataset]);

  return (
    <div className="flex flex-col min-h-screen w-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
      <header ref={headerRef} className="bg-white dark:bg-gray-800 shadow-md border-b sticky top-0 z-50">
        <div className="w-full px-0 flex justify-between items-center py-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-white" />
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
          {activeTab !== 'upload' && (
            <button
              onClick={handleNewUploadClick}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm"
            >
              <FileUp size={18} />
              <span>Upload New</span>
            </button>
          )}
        </div>
        <nav className="bg-white dark:bg-gray-800 border-t">
          <div className="w-full px-0 flex space-x-4">
            {appTabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  disabled={tab.disabled}
                  onClick={() => !tab.disabled && setActiveTab(tab.id as ActiveTabType)}
                  className={`flex items-center space-x-2 py-3 px-3 border-b-2 text-sm ${
                    isActive ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      <main
        className="flex-grow overflow-y-auto bg-white dark:bg-gray-800"
        style={{ height: `calc(100vh - ${headerHeight}px)` }}
      >
        {activeTab === 'upload' && (
          <div className="w-full py-8 flex items-center justify-center">
            <DataUpload onDatasetUploaded={handleDatasetUploaded} />
          </div>
        )}

        {activeTab === 'preview' && currentDataset && (
          <div className="w-full py-8">
            <DataPreview datasetId={currentDataset.id} />
          </div>
        )}

        {activeTab === 'analysis' && currentDataset && (
          <>
            {/* Desktop: inner tabs */}
            <div className="hidden md:flex border-b bg-white dark:bg-gray-800 px-4">
              {(['chat', 'results', 'visualization'] as const).map(tab => {
                const label = tab === 'chat' ? 'AI Analysis Chat' : tab === 'results' ? 'Analysis Results' : 'Generate Visualizations';
                const isActive = analysisSubTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setAnalysisSubTab(tab)}
                    className={`py-3 px-4 -mb-px border-b-2 text-sm ${
                      isActive
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="hidden md:block p-4 h-full overflow-auto">
              {analysisSubTab === 'chat' && <ChatInterface datasetId={currentDataset.id} />}
              {analysisSubTab === 'results' && (
                <ResultsPanel
                  datasetId={currentDataset.id}
                  analysisResults={analysisResults}
                  onVisualize={setVisualizationConfig}
                  onSwitchTab={setAnalysisSubTab}
                />
              )}
              {analysisSubTab === 'visualization' && (
                <VisualizationPanel datasetId={currentDataset.id} visualizationConfig={visualizationConfig} />
              )}
            </div>

            {/* Mobile: accordion panels */}
            <div className="flex flex-col space-y-2 md:hidden px-4">
              {/* Chat Accordion */}
              <button
                onClick={() => setMobileOpen(mobileOpen === 'chat' ? null : 'chat')}
                className="w-full text-left py-2 px-4 bg-gray-200 dark:bg-gray-700 rounded-lg"
              >
                AI Analysis Chat
              </button>
              {mobileOpen === 'chat' && (
                <div className="p-2 border rounded-lg bg-white dark:bg-gray-800">
                  <ChatInterface datasetId={currentDataset.id} />
                </div>
              )}
              {/* Results Accordion */}
              <button
                onClick={() => setMobileOpen(mobileOpen === 'results' ? null : 'results')}
                className="w-full text-left py-2 px-4 bg-gray-200 dark:bg-gray-700 rounded-lg"
              >
                Analysis Results
              </button>
              {mobileOpen === 'results' && (
                <div className="p-2 border rounded-lg bg-white dark:bg-gray-800">
                  <ResultsPanel
                    datasetId={currentDataset.id}
                    analysisResults={analysisResults}
                    onVisualize={setVisualizationConfig}
                    onSwitchTab={setAnalysisSubTab}
                  />
                </div>
              )}
              {/* Visualization Accordion */}
              <button
                onClick={() => setMobileOpen(mobileOpen === 'visualization' ? null : 'visualization')}
                className="w-full text-left py-2 px-4 bg-gray-200 dark:bg-gray-700 rounded-lg"
              >
                Generate Visualizations
              </button>
              {mobileOpen === 'visualization' && (
                <div className="p-2 border rounded-lg bg-white dark:bg-gray-800">
                  <VisualizationPanel datasetId={currentDataset.id} visualizationConfig={visualizationConfig} />
                </div>
              )}
            </div>
          </>
        )}

        {!currentDataset && activeTab === 'analysis' && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Info size={48} className="text-yellow-500 mb-4" />
            <h2 className="text-2xl font-semibold mb-2">No Dataset Loaded</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Please go to the 'Upload Data' tab to load a dataset.</p>
            <button onClick={() => setActiveTab('upload')} className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
              Go to Upload
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
