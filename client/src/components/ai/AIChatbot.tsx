import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Bot, 
  User, 
  Send, 
  X, 
  Lightbulb,
  BookOpen,
  Shield,
  TrendingUp,
  MessageCircle,
  Minimize2,
  Maximize2
} from 'lucide-react';
import { api } from '@/lib/api';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  suggestions?: string[];
}

interface AIChatbotProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AIChatbot({ isOpen, onClose }: AIChatbotProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);

  const chatMutation = useMutation({
    mutationFn: (message: string) => api.chatWithAI(message, { userRole: user?.role }),
    onSuccess: (data, variables) => {
      const aiMessage: Message = {
        id: Date.now().toString() + '-ai',
        content: data.response,
        sender: 'ai',
        timestamp: new Date(),
        suggestions: getContextualSuggestions()
      };
      setMessages(prev => [...prev, aiMessage]);
      scrollToBottom();
    },
    onError: (error: any) => {
      toast({
        title: 'AI Chat Error',
        description: 'Failed to get AI response. Please try again.',
        variant: 'destructive'
      });
    }
  });

  const recommendationsMutation = useMutation({
    mutationFn: api.getAIRecommendations,
    onSuccess: (data) => {
      const recommendationText = data.map((rec: any, index: number) => 
        `${index + 1}. **${rec.title}** (${rec.priority} priority)\n   ${rec.description}\n   *Reason: ${rec.reason}*`
      ).join('\n\n');

      const aiMessage: Message = {
        id: Date.now().toString() + '-recommendations',
        content: `Based on your current progress, here are my personalized recommendations:\n\n${recommendationText}`,
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMessage]);
      scrollToBottom();
    }
  });

  // Initialize with welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessage: Message = {
        id: 'welcome',
        content: getWelcomeMessage(),
        sender: 'ai',
        timestamp: new Date(),
        suggestions: getInitialSuggestions()
      };
      setMessages([welcomeMessage]);
    }
  }, [isOpen, user]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const getWelcomeMessage = () => {
    const roleSpecificGreeting = {
      'super_admin': 'Hello! I\'m your AI assistant for platform management. I can help you with client analytics, system insights, and administrative tasks.',
      'client_admin': 'Hi there! I\'m here to help you manage your cybersecurity training program. I can assist with user management, campaign analysis, and course recommendations.',
      'end_user': 'Welcome! I\'m your personal cybersecurity training assistant. I can help you understand course content, recommend training, and answer security questions.'
    };

    return roleSpecificGreeting[user?.role as keyof typeof roleSpecificGreeting] || 'Hello! How can I help you with cybersecurity training today?';
  };

  const getInitialSuggestions = () => {
    const roleSuggestions = {
      'super_admin': [
        'Show me platform-wide analytics',
        'Which clients need attention?',
        'Generate a platform health report'
      ],
      'client_admin': [
        'Recommend training for phishing awareness',
        'How are our users performing?',
        'Generate 5 quiz questions for email security'
      ],
      'end_user': [
        'What training should I take next?',
        'Explain phishing attack types',
        'How can I identify suspicious emails?'
      ]
    };

    return roleSuggestions[user?.role as keyof typeof roleSuggestions] || [
      'What is cybersecurity?',
      'Tell me about phishing',
      'How can I stay secure online?'
    ];
  };

  const getContextualSuggestions = () => {
    // Return contextual suggestions based on the conversation
    return [
      'Tell me more about this topic',
      'How can I implement this?',
      'What are the next steps?'
    ];
  };

  const handleSendMessage = () => {
    if (!inputValue.trim() || chatMutation.isPending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    
    // Send to AI
    chatMutation.mutate(inputValue);
    scrollToBottom();
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (suggestion === 'Recommend training for phishing awareness' || 
        suggestion === 'What training should I take next?') {
      recommendationsMutation.mutate();
    } else {
      setInputValue(suggestion);
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50" data-testid="ai-chatbot">
      <Card className={`w-80 shadow-lg transition-all duration-300 ${
        isMinimized ? 'h-16' : 'h-96'
      }`}>
        <CardHeader className="p-4 border-b border-border bg-primary text-primary-foreground rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary-foreground/20 rounded-full flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-medium">AI Assistant</CardTitle>
                {chatMutation.isPending && (
                  <p className="text-xs opacity-80">Thinking...</p>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-1">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setIsMinimized(!isMinimized)}
                className="text-primary-foreground hover:bg-primary-foreground/20 p-1 h-auto"
                data-testid="button-minimize-chat"
              >
                {isMinimized ? (
                  <Maximize2 className="w-4 h-4" />
                ) : (
                  <Minimize2 className="w-4 h-4" />
                )}
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={onClose}
                className="text-primary-foreground hover:bg-primary-foreground/20 p-1 h-auto"
                data-testid="button-close-chat"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        {!isMinimized && (
          <>
            <CardContent className="flex-1 p-0 h-64 overflow-y-auto">
              <div className="p-4 space-y-4" data-testid="chat-messages">
                {messages.map((message) => (
                  <div key={message.id} className="ai-chat-bubble">
                    <div className={`flex items-start space-x-3 ${
                      message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                    }`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        message.sender === 'ai' 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-secondary text-secondary-foreground'
                      }`}>
                        {message.sender === 'ai' ? (
                          <Bot className="w-4 h-4" />
                        ) : (
                          <User className="w-4 h-4" />
                        )}
                      </div>
                      <div className="flex-1 max-w-xs">
                        <div className={`rounded-lg p-3 ${
                          message.sender === 'ai' 
                            ? 'bg-muted' 
                            : 'bg-primary text-primary-foreground'
                        }`}>
                          <p className="text-sm whitespace-pre-wrap" data-testid={`message-${message.id}`}>
                            {message.content}
                          </p>
                        </div>
                        {message.suggestions && message.suggestions.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {message.suggestions.map((suggestion, index) => (
                              <Button
                                key={index}
                                variant="outline"
                                size="sm"
                                onClick={() => handleSuggestionClick(suggestion)}
                                className="w-full text-xs h-auto py-1 px-2 justify-start"
                                data-testid={`suggestion-${index}`}
                              >
                                {suggestion}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {chatMutation.isPending && (
                  <div className="ai-chat-bubble">
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-primary-foreground" />
                      </div>
                      <div className="flex-1">
                        <div className="bg-muted rounded-lg p-3">
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            </CardContent>
            
            <div className="p-4 border-t border-border">
              {/* Quick Actions */}
              <div className="flex space-x-2 mb-3">
                {user?.role === 'end_user' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSuggestionClick('What training should I take next?')}
                      disabled={recommendationsMutation.isPending}
                      data-testid="button-get-recommendations"
                    >
                      <Lightbulb className="w-3 h-3 mr-1" />
                      <span className="text-xs">Recommendations</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSuggestionClick('Explain phishing attack types')}
                      data-testid="button-explain-phishing"
                    >
                      <Shield className="w-3 h-3 mr-1" />
                      <span className="text-xs">Phishing</span>
                    </Button>
                  </>
                )}
                
                {(user?.role === 'client_admin' || user?.role === 'super_admin') && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSuggestionClick('How are our users performing?')}
                      data-testid="button-user-performance"
                    >
                      <TrendingUp className="w-3 h-3 mr-1" />
                      <span className="text-xs">Analytics</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSuggestionClick('Generate 5 quiz questions for email security')}
                      data-testid="button-generate-quiz"
                    >
                      <BookOpen className="w-3 h-3 mr-1" />
                      <span className="text-xs">Quiz</span>
                    </Button>
                  </>
                )}
              </div>

              {/* Message Input */}
              <div className="flex space-x-2">
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me anything about cybersecurity training..."
                  className="flex-1 text-sm"
                  disabled={chatMutation.isPending}
                  data-testid="input-chat-message"
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || chatMutation.isPending}
                  size="sm"
                  data-testid="button-send-message"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
