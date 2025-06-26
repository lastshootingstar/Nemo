import React, { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Send, Bot, User, Lightbulb, Loader2 } from 'lucide-react';

interface ChatInterfaceProps {
  datasetId: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  analysisResults?: any;   // <-- Added this line
  visualization?: any;
  suggestions?: string[];
}

interface ChatResponse {
  response: string;
  analysisResults?: any;   // <-- Backend returns this
  visualization?: any;
  suggestions?: string[];
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ datasetId }) => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch chat history
  const { data: history } = useQuery<ChatMessage[]>({
    queryKey: ['chatHistory', datasetId],
    queryFn: async () => {
      const response = await fetch(`/api/chat/history/${datasetId}`);
      if (!response.ok) return [];
      const result = await response.json();
      return result.data || [];
    },
  });

  // Fetch suggestions
  const { data: suggestions } = useQuery<{ suggestions: string[] }>({
    queryKey: ['suggestions', datasetId],
    queryFn: async () => {
      const response = await fetch(`/api/chat/suggestions/${datasetId}`);
      if (!response.ok) throw new Error('Failed to fetch suggestions');
      const result = await response.json();
      return result.data;
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (userMessage: string): Promise<ChatResponse> => {
      const response = await fetch('/api/chat/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          datasetId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message');
      }

      const result = await response.json();
      return result.data;
    },
    onSuccess: (data, userMessage) => {
      const userMsg: ChatMessage = {
        role: 'user',
        content: userMessage,
        timestamp: new Date().toISOString(),
      };

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString(),
        analysisResults: data.analysisResults, // <-- Fix: use analysisResults!
        visualization: data.visualization,
        suggestions: data.suggestions,
      };

      setMessages(prev => [...prev, userMsg, assistantMsg]);
      setMessage('');
    },
  });

  // Update messages when history is loaded
  useEffect(() => {
    if (history && history.length > 0) {
      setMessages(history);
    }
  }, [history]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !sendMessageMutation.isPending) {
      sendMessageMutation.mutate(message.trim());
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setMessage(suggestion);
  };

  return (
    <div className="max-w-4xl mx-auto h-[600px] flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow">
      {/* Header */}
      <div className="flex items-center space-x-3 p-4 border-b border-gray-200 dark:border-gray-700">
        <Bot className="w-6 h-6 text-blue-600" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">AI Data Analyst</h2>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Ask questions about your data in natural language
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <Bot className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Start analyzing your data
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Ask questions about your dataset and I'll help you discover insights
            </p>
            
            {/* Suggestions */}
            {suggestions && suggestions.suggestions.length > 0 && (
              <div className="max-w-md mx-auto">
                <div className="flex items-center space-x-2 mb-3">
                  <Lightbulb className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Try asking:
                  </span>
                </div>
                <div className="space-y-2">
                  {suggestions.suggestions.slice(0, 4).map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="block w-full text-left p-3 text-sm bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  {msg.role === 'user' ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                  <span className="text-xs opacity-75">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm">{msg.content}</p>
                
                {/* Updated Analysis Results Section */}
                {msg.analysisResults && (
                  <div>
                    <div>
                      Analysis Results: {msg.analysisResults.title}
                    </div>
                    <div>
                      Description: {msg.analysisResults.description}
                    </div>
                    
                    {msg.analysisResults.data && msg.analysisResults.data.map((columnData: any) => (
                      <div key={columnData.column} className="mb-4">
                        <h5 className="font-bold mb-2">{columnData.column}</h5>
                        <div className="grid grid-cols-2 gap-2">
                          <div>Count: {columnData.count}</div>
                          <div>Mean: {columnData.mean?.toFixed(2)}</div>
                          <div>Median: {columnData.median}</div>
                          <div>Std Dev: {columnData.standardDeviation?.toFixed(2)}</div>
                          <div>Variance: {columnData.variance?.toFixed(2)}</div>
                          <div>Min: {columnData.min}</div>
                          <div>Max: {columnData.max}</div>
                          <div>Mode: {columnData.mode}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Suggestions */}
                {msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-xs font-medium mb-2">Follow-up suggestions:</h4>
                    <div className="space-y-1">
                      {msg.suggestions.slice(0, 2).map((suggestion, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="block w-full text-left text-xs p-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded border transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        
        {sendMessageMutation.isPending && (
          <div className="flex justify-start">
            <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700">
              <div className="flex items-center space-x-2">
                <Bot className="w-4 h-4" />
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Analyzing your question...
                </span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex space-x-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask a question about your data..."
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            disabled={sendMessageMutation.isPending}
          />
          <button
            type="submit"
            disabled={!message.trim() || sendMessageMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        
        {sendMessageMutation.error && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            {sendMessageMutation.error.message}
          </p>
        )}
      </form>
    </div>
  );
};

export default ChatInterface;
