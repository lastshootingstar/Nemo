import React, { useState } from 'react';
import DataUpload from './components/DataUpload';
import DataPreview from './components/DataPreview';
import ChatInterface from './components/ChatInterface';
import VisualizationPanel from './components/VisualizationPanel';
import { Database, MessageSquare, BarChart3, Upload } from 'lucide-react';

interface Dataset {
  id: string;
  name: string;
  fileName: string;
  uploadedAt: string;
  rows: number;
  columns: number;
}

function App() {
  const [currentDataset, setCurrentDataset] = useState<Dataset | null>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'data' | 'chat' | 'visualize'>('upload');

  const handleDatasetUploaded = (dataset: Dataset) => {
    setCurrentDataset(dataset);
    setActiveTab('data');
  };

  const tabs = [
    { id: 'upload', label: 'Upload Data', icon: Upload },
    { id: 'data', label: 'Data Preview', icon: Database, disabled: !currentDataset },
    { id: 'chat', label: 'AI Analysis', icon: MessageSquare, disabled: !currentDataset },
    { id: 'visualize', label: 'Visualizations', icon: BarChart3, disabled: !currentDataset },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">NemoClinical</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Data Analysis Platform</p>
              </div>
            </div>
            {currentDataset && (
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{currentDataset.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {currentDataset.rows} rows, {currentDataset.columns} columns
                </p>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const isDisabled = tab.disabled;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => !isDisabled && setActiveTab(tab.id as any)}
                  disabled={isDisabled}
                  className={`
                    flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                    ${isActive
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : isDisabled
                      ? 'border-transparent text-gray-400 dark:text-gray-600 cursor-not-allowed'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'upload' && (
          <DataUpload onDatasetUploaded={handleDatasetUploaded} />
        )}
        
        {activeTab === 'data' && currentDataset && (
          <DataPreview datasetId={currentDataset.id} />
        )}
        
        {activeTab === 'chat' && currentDataset && (
          <ChatInterface datasetId={currentDataset.id} />
        )}
        
        {activeTab === 'visualize' && currentDataset && (
          <VisualizationPanel datasetId={currentDataset.id} />
        )}
      </main>
    </div>
  );
}

export default App;

