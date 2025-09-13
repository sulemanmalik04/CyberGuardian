import { useEffect, useRef, useState, useCallback } from 'react';
import { useToast } from './use-toast';

interface WebSocketMessage {
  type: string;
  data?: any;
  event?: any;
  metrics?: any;
  alert?: any;
  notification?: any;
  timestamp?: string;
  clientId?: string;
  status?: string;
  userId?: string;
  role?: string;
}

interface UseWebSocketOptions {
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    autoConnect = true,
    reconnectInterval = 5000,
    maxReconnectAttempts = 5,
    onMessage,
    onConnect,
    onDisconnect,
    onError
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionStatus('connecting');

    // Get auth token
    const token = localStorage.getItem('auth_token');
    if (!token) {
      console.error('No auth token available for WebSocket connection');
      setConnectionStatus('error');
      return;
    }

    // Create WebSocket connection with token in query params
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}?token=${encodeURIComponent(token)}`;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        setIsConnected(true);
        setConnectionStatus('connected');
        reconnectAttemptsRef.current = 0;
        
        // Subscribe to analytics updates
        ws.send(JSON.stringify({
          type: 'subscribe',
          channel: 'analytics'
        }));

        onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          console.log('📩 WebSocket message:', message.type);
          
          // Handle different message types
          switch (message.type) {
            case 'connection':
              console.log('WebSocket authenticated:', message);
              break;
              
            case 'analytics_update':
              console.log('Analytics update:', message.event);
              onMessage?.(message);
              break;
              
            case 'platform_metrics':
              console.log('Platform metrics update:', message.metrics);
              onMessage?.(message);
              break;
              
            case 'alert':
              console.log('Alert received:', message.alert);
              toast({
                title: "Alert",
                description: message.alert.message || "New alert received",
                variant: message.alert.severity === 'error' ? 'destructive' : 'default',
              });
              onMessage?.(message);
              break;
              
            case 'notification':
              console.log('Notification received:', message.notification);
              toast({
                title: "Notification",
                description: message.notification.message || "New notification",
              });
              onMessage?.(message);
              break;
              
            case 'subscribed':
              console.log('Subscribed to channel:', message);
              break;
              
            case 'pong':
              // Heartbeat response
              break;
              
            case 'error':
              console.error('WebSocket error:', message);
              break;
              
            default:
              onMessage?.(message);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setConnectionStatus('error');
        onError?.(new Error('WebSocket connection error'));
      };

      ws.onclose = (event) => {
        console.log('🔌 WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        setConnectionStatus('disconnected');
        wsRef.current = null;
        onDisconnect?.();

        // Attempt to reconnect if not a normal closure
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          console.log(`Reconnecting... (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          console.error('Max reconnection attempts reached');
          setConnectionStatus('error');
          toast({
            title: "Connection Lost",
            description: "Unable to reconnect to real-time updates. Please refresh the page.",
            variant: "destructive",
          });
        }
      };

      // Heartbeat to keep connection alive
      const heartbeatInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000); // Every 30 seconds

      // Cleanup heartbeat on close
      ws.addEventListener('close', () => {
        clearInterval(heartbeatInterval);
      });

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionStatus('error');
      onError?.(error as Error);
    }
  }, [reconnectInterval, maxReconnectAttempts, onConnect, onDisconnect, onError, onMessage, toast]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setConnectionStatus('disconnected');
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    console.warn('Cannot send message: WebSocket is not connected');
    return false;
  }, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect]); // Only run on mount/unmount

  return {
    isConnected,
    connectionStatus,
    connect,
    disconnect,
    sendMessage,
  };
}

// Hook for analytics-specific WebSocket updates
export function useAnalyticsWebSocket(onAnalyticsUpdate?: (event: any) => void) {
  const [latestEvent, setLatestEvent] = useState<any>(null);
  const [platformMetrics, setPlatformMetrics] = useState<any>(null);

  const { isConnected, connectionStatus } = useWebSocket({
    onMessage: (message) => {
      if (message.type === 'analytics_update') {
        setLatestEvent(message.event);
        onAnalyticsUpdate?.(message.event);
      } else if (message.type === 'platform_metrics') {
        setPlatformMetrics(message.metrics);
      }
    },
  });

  return {
    isConnected,
    connectionStatus,
    latestEvent,
    platformMetrics,
  };
}