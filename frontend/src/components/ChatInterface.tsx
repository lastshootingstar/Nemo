import React, { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Send, Bot, User, Lightbulb, Loader2, TestTube2, Zap, BarChartHorizontalBig, HelpCircle } from 'lucide-react';

interface ChatInterfaceProps {
  datasetId: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  // resultId?: string; // Removing resultId as we simplify to a single chat flow for now
  analysisResults?: any; // To hold structured results for potential display or use
  visualization?: any;   // To hold visualization suggestions
  suggestions?: string[];// To hold follow-up suggestions
}

interface ChatResponse { // This is the expected structure from /api/chat/query
  response: string;       // Gemini's textual explanation/answer
  analysis?: any;         // Gemini's suggested analysis object (type, columns)
  visualization?: any;    // Gemini's suggested visualization object
  suggestions?: string[]; // Gemini's follow-up suggestions
  analysisResults?: any;  // Actual structured results from DataAnalyzer
}


const QuickTestButton: React.FC<{label: string, onClick: () => void, icon?: React.ElementType}> = ({ label, onClick, icon: Icon }) => (
    <button
      onClick={onClick}
      className="w-full flex items-center space-x-2 p-2 text-sm bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors text-gray-700 dark:text-gray-300"
    >
      {Icon && <Icon className="w-4 h-4 text-blue-500" />}
      <span>{label}</span>
    </button>
);


const ChatInterface: React.FC<ChatInterfaceProps> = ({ datasetId }) => {
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: initialSuggestions } = useQuery<{ suggestions: string[] }>({
    queryKey: ['chatSuggestions', datasetId],
    queryFn: async () => {
      const response = await fetch(`/api/chat/suggestions/${datasetId}`);
      if (!response.ok) throw new Error('Failed to fetch suggestions');
      const result = await response.json();
      return result.data?.suggestions || [];
    },
    enabled: !!datasetId, // Only fetch if datasetId is available
  });


  const { data: chatHistory, isLoading: isLoadingHistory } = useQuery<ChatMessage[]>({
    queryKey: ['chatHistory', datasetId],
    queryFn: async () => {
      const response = await fetch(`/api/chat/history/${datasetId}`);
      if (!response.ok) {
        // console.error("Failed to fetch chat history:", response.statusText);
        return [];
      }
      const result = await response.json();
      return result.data || [];
    },
    enabled: !!datasetId,
    onSuccess: (data) => {
      if (data && data.length > 0) {
        setChatMessages(data);
      }
    }
  });


  const sendMessageMutation = useMutation<ChatResponse, Error, { message: string; datasetId: string }>({
    mutationFn: async (messageData) => {
      const response = await fetch('/api/chat/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageData),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to send message: Invalid JSON response' }));
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'API returned unsuccessful status');
      }
      return result.data;
    },
    onSuccess: (data, variables) => {
      const userMsg: ChatMessage = {
        role: 'user',
        content: variables.message,
        timestamp: new Date().toISOString(),
      };
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString(),
        analysisResults: data.analysisResults, // Store structured results
        visualization: data.visualization,
        suggestions: data.suggestions,
      };
      setChatMessages(prev => [...prev, userMsg, assistantMsg]);
      setMessage('');

      // Dispatch custom event with analysis results for other panels
      if (data.analysisResults || data.visualization) {
        const event = new CustomEvent('analysisComplete', {
          detail: {
            analysisResults: data.analysisResults,
            visualization: data.visualization || data.analysisResults?.visualization // Pass top-level or nested viz config
          }
        });
        window.dispatchEvent(event);
      }
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Listen for 'askAboutResult' event from ResultsPanel
  useEffect(() => {
    const handleAskAboutResultEvent = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail && customEvent.detail.result && customEvent.detail.resultType) {
        const { result, resultType } = customEvent.detail;
        // Sanitize or summarize the result if it's too large for a prompt
        let resultContext = JSON.stringify(result);
        if (resultContext.length > 1000) { // Arbitrary limit for prompt
            resultContext = `Summary of ${resultType}: ${Object.keys(result).slice(0,5).join(', ')}... (full data not shown due to length)`;
        }

        const query = `Can you explain these ${resultType} results for me?\n\n${resultContext}`;
        setMessage(query); // Optionally set the input field
        sendMessageMutation.mutate({ message: query, datasetId });
      }
    };

    window.addEventListener('askAboutResult', handleAskAboutResultEvent);
    return () => {
      window.removeEventListener('askAboutResult', handleAskAboutResultEvent);
    };
  }, [datasetId, sendMessageMutation]); // Add dependencies


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !sendMessageMutation.isPending) {
      sendMessageMutation.mutate({ message: message.trim(), datasetId });
    }
  };

  const handleQuickTestClick = (testName: string, query: string) => {
    setMessage(query); // Set the input field, user can modify if needed
    sendMessageMutation.mutate({ message: query, datasetId });
  };

  const basicTests = [
    { name: 'Descriptive Statistics', query: 'Show descriptive statistics for the dataset.', icon: BarChartHorizontalBig },
    { name: 'Correlation Analysis', query: 'Perform Pearson correlation analysis.', icon: Zap },
    // { name: 'T-Test', query: 'I want to perform an independent samples t-test.', icon: TestTube2 },
    // { name: 'Chi-Square Test', query: 'Perform a chi-square test.', icon: HelpCircle },
  ];

  const advancedTests = [
    { name: 'Linear Regression', query: 'Perform linear regression.', icon: TestTube2, comingSoon: true },
    { name: 'ROC Analysis', query: 'Perform ROC analysis.', icon: HelpCircle, comingSoon: true },
  ];


  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800"> {/* Adjusted to fill height */}
      {/* Header */}
      <div className="flex items-center space-x-3 p-3 border-b border-gray-200 dark:border-gray-700">
        <Bot className="w-6 h-6 text-blue-500" />
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white">AI Analysis Chat</h2>
      </div>

      {/* Quick Test Buttons Section */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Quick Analyses</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            {/* <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Basic</h4> */}
            <div className="space-y-1">
              {basicTests.map(test => (
                <QuickTestButton
                  key={test.name}
                  label={test.name}
                  icon={test.icon}
                  onClick={() => handleQuickTestClick(test.name, test.query)}
                />
              ))}
            </div>
          </div>
          <div>
            {/* <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Advanced (Coming Soon)</h4> */}
             <div className="space-y-1">
              {advancedTests.map(test => (
                <QuickTestButton
                  key={test.name}
                  label={test.name}
                  icon={test.icon}
                  onClick={() => alert(`${test.name} is coming soon!`)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>


      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoadingHistory && (
            <div className="flex justify-center items-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        )}
        {!isLoadingHistory && chatMessages.length === 0 && (
          <div className="text-center py-8">
            <Bot className="w-12 h-12 text-gray-400 dark:text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-700 dark:text-white mb-2">
              Start Analyzing Your Data
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Ask questions or use the quick analysis buttons above.
            </p>
            {initialSuggestions && initialSuggestions.length > 0 && (
              <div className="w-full">
                <div className="flex items-center space-x-2 mb-2">
                  <Lightbulb className="w-4 h-4 text-yellow-400" />
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    Suggestions:
                  </span>
                </div>
                <div className="space-y-1">
                  {initialSuggestions.slice(0, 3).map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => setMessage(suggestion)}
                      className="block w-full text-left p-2 text-xs bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors text-gray-600 dark:text-gray-300"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {chatMessages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-3 py-2 rounded-lg shadow-sm ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
              }`}
            >
              <div className="flex items-center space-x-2 mb-0.5">
                {msg.role === 'user' ? (
                  <User className="w-3 h-3" />
                ) : (
                  <Bot className="w-3 h-3" />
                )}
                <span className="text-xs opacity-70">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              {/* Display suggestions from assistant if any */}
              {msg.role === 'assistant' && msg.suggestions && msg.suggestions.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                  <h4 className="text-xs font-semibold mb-1 opacity-80">Suggestions:</h4>
                  <div className="space-y-1">
                    {msg.suggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => setMessage(suggestion)}
                        className={`block w-full text-left text-xs p-1.5 rounded transition-colors ${
                            msg.role === 'user'
                            ? 'bg-blue-400 hover:bg-blue-300'
                            : 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500'
                        }`}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {sendMessageMutation.isPending && (
          <div className="flex justify-start">
            <div className="max-w-xs px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
              <div className="flex items-center space-x-2">
                <Bot className="w-4 h-4" />
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex space-x-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask a question or select a quick analysis..."
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            disabled={sendMessageMutation.isPending || !datasetId}
          />
          <button
            type="submit"
            disabled={!message.trim() || sendMessageMutation.isPending || !datasetId}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        {sendMessageMutation.error && (
          <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">
            Error: {sendMessageMutation.error.message}
          </p>
        )}
      </form>
    </div>
  );
};

export default ChatInterface;
