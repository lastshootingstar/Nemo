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
  resultId?: string; // Added resultId to associate messages with results
  analysisResults?: any;
  visualization?: any;
  suggestions?: string[];
}

interface ChatResponse {
  response: string;
  analysisResults?: any;
  visualization?: any;
  suggestions?: string[];
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ datasetId }) => {
  const [generalMessage, setGeneralMessage] = useState('');
  const [resultsMessage, setResultsMessage] = useState('');
  const [generalMessages, setGeneralMessages] = useState<ChatMessage[]>([]);
  const [resultsMessages, setResultsMessages] = useState<ChatMessage[]>([]);
  const [activeResultId, setActiveResultId] = useState<string | null>(null);
  const generalMessagesEndRef = useRef<HTMLDivElement>(null);
  const resultsMessagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch chat history
  const { data: generalHistory } = useQuery<ChatMessage[]>({
    queryKey: ['generalChatHistory', datasetId],
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
    mutationFn: async (messageData: { message: string; datasetId: string; resultId?: string }): Promise<ChatResponse> => {
      const response = await fetch('/api/chat/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message');
      }

      const result = await response.json();
      return result.data;
    },
    onSuccess: (data, messageData) => {
      const userMsg: ChatMessage = {
        role: 'user',
        content: messageData.message,
        timestamp: new Date().toISOString(),
        resultId: messageData.resultId,
      };

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString(),
        resultId: messageData.resultId,
        analysisResults: data.analysisResults,
        visualization: data.visualization,
        suggestions: data.suggestions,
      };

      if (messageData.resultId) {
        setResultsMessages(prev => [...prev, userMsg, assistantMsg]);
      } else {
        setGeneralMessages(prev => [...prev, userMsg, assistantMsg]);
      }
      setGeneralMessage('');
      setResultsMessage('');
    },
  });

  // Update messages when history is loaded
  useEffect(() => {
    if (generalHistory && generalHistory.length > 0) {
      setGeneralMessages(generalHistory);
    }
  }, [generalHistory]);

  // Scroll to bottom when messages change
  useEffect(() => {
    generalMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    resultsMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [generalMessages, resultsMessages]);

  const handleGeneralSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (generalMessage.trim() && !sendMessageMutation.isPending) {
      sendMessageMutation.mutate({ message: generalMessage.trim(), datasetId });
    }
  };

  const handleResultsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (resultsMessage.trim() && !sendMessageMutation.isPending && activeResultId) {
      sendMessageMutation.mutate({ message: resultsMessage.trim(), datasetId, resultId: activeResultId });
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setGeneralMessage(suggestion);
  };

  const handleResultsDiscussion = (resultId: string) => {
    setActiveResultId(resultId);
  };

  return (
    <div className="max-w-4xl mx-auto h-[600px] flex bg-white dark:bg-gray-800 rounded-lg shadow">
      {/* General Chat */}
      <div className="w-1/2 flex flex-col border-r border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3 p-4 border-b border-gray-200 dark:border-gray-700">
          <Bot className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">General Chat</h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Ask general questions about your data
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {generalMessages.length === 0 ? (
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
            generalMessages.map((msg, index) => (
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

          <div ref={generalMessagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleGeneralSubmit} className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex space-x-2">
            <input
              type="text"
              value={generalMessage}
              onChange={(e) => setGeneralMessage(e.target.value)}
              placeholder="Ask a question about your data..."
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              disabled={sendMessageMutation.isPending}
            />
            <button
              type="submit"
              disabled={!generalMessage.trim() || sendMessageMutation.isPending}
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

      {/* Results Chat */}
      <div className="w-1/2 flex flex-col">
        <div className="flex items-center space-x-3 p-4 border-b border-gray-200 dark:border-gray-700">
          <Bot className="w-6 h-6 text-green-600" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Results Chat</h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Discuss specific analysis results
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {resultsMessages.length === 0 ? (
            <div className="text-center py-8">
              <Bot className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Discuss your results
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Ask questions about specific analysis results for deeper insights
              </p>
            </div>
          ) : (
            resultsMessages.map((msg, index) => (
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
                </div>
              </div>
            ))
          )}

          <div ref={resultsMessagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleResultsSubmit} className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex space-x-2">
            <input
              type="text"
              value={resultsMessage}
              onChange={(e) => setResultsMessage(e.target.value)}
              placeholder="Ask a question about the results..."
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              disabled={sendMessageMutation.isPending || !activeResultId}
            />
            <button
              type="submit"
              disabled={!resultsMessage.trim() || sendMessageMutation.isPending || !activeResultId}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
    </div>
  );
};

export default ChatInterface;
