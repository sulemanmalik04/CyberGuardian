import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import jwt from "jsonwebtoken";
import { storage } from "./storage";

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  clientId?: string;
  role?: string;
  isAlive?: boolean;
}

export let wss: WebSocketServer | null = null;

export function setupWebSocketServer(server: Server) {
  wss = new WebSocketServer({ server });
  
  console.log("✅ WebSocket server initialized");
  
  // Handle new connections
  wss.on("connection", async (ws: AuthenticatedWebSocket, req) => {
    console.log("🔌 New WebSocket connection attempt");
    
    // Extract token from query parameters
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");
    
    if (!token) {
      console.log("❌ WebSocket connection rejected: No token provided");
      ws.close(1008, "Authentication required");
      return;
    }
    
    try {
      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key") as any;
      const user = await storage.getUser(decoded.userId);
      
      if (!user) {
        console.log("❌ WebSocket connection rejected: Invalid user");
        ws.close(1008, "Invalid authentication");
        return;
      }
      
      // Store user info on the socket
      ws.userId = user.id;
      ws.clientId = user.clientId || undefined;
      ws.role = user.role;
      ws.isAlive = true;
      
      console.log(`✅ WebSocket authenticated: ${user.email} (${user.role})`);
      
      // Send initial connection success message
      ws.send(JSON.stringify({
        type: "connection",
        status: "connected",
        userId: user.id,
        role: user.role
      }));
      
      // Handle ping/pong for connection health
      ws.on("pong", () => {
        ws.isAlive = true;
      });
      
      // Handle incoming messages
      ws.on("message", async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await handleWebSocketMessage(ws, message);
        } catch (error) {
          console.error("WebSocket message error:", error);
          ws.send(JSON.stringify({
            type: "error",
            message: "Invalid message format"
          }));
        }
      });
      
      // Handle disconnection
      ws.on("close", () => {
        console.log(`🔌 WebSocket disconnected: User ${ws.userId}`);
      });
      
      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
      });
      
    } catch (error) {
      console.log("❌ WebSocket authentication failed:", error);
      ws.close(1008, "Authentication failed");
    }
  });
  
  // Periodic ping to check connection health
  const interval = setInterval(() => {
    wss?.clients.forEach((ws) => {
      const authWs = ws as AuthenticatedWebSocket;
      if (authWs.isAlive === false) {
        return authWs.terminate();
      }
      authWs.isAlive = false;
      authWs.ping();
    });
  }, 30000); // 30 seconds
  
  wss.on("close", () => {
    clearInterval(interval);
  });
}

async function handleWebSocketMessage(ws: AuthenticatedWebSocket, message: any) {
  switch (message.type) {
    case "subscribe":
      // Handle subscription to specific analytics channels
      if (message.channel === "analytics") {
        // User is subscribing to analytics updates
        ws.send(JSON.stringify({
          type: "subscribed",
          channel: "analytics"
        }));
      }
      break;
      
    case "ping":
      // Simple ping/pong for client-side connection check
      ws.send(JSON.stringify({ type: "pong" }));
      break;
      
    default:
      ws.send(JSON.stringify({
        type: "error",
        message: `Unknown message type: ${message.type}`
      }));
  }
}

// Broadcast analytics update to relevant clients
export function broadcastAnalyticsUpdate(clientId: string, event: any) {
  if (!wss) return;
  
  const message = JSON.stringify({
    type: "analytics_update",
    clientId,
    event,
    timestamp: new Date().toISOString()
  });
  
  wss.clients.forEach((client) => {
    const authClient = client as AuthenticatedWebSocket;
    
    // Only send to clients that are ready and authorized
    if (client.readyState === WebSocket.OPEN) {
      // Super admins see all updates
      if (authClient.role === "super_admin") {
        client.send(message);
      }
      // Client admins and users only see their own client's updates
      else if (authClient.clientId === clientId) {
        client.send(message);
      }
    }
  });
}

// Broadcast platform-wide metrics (super admin only)
export function broadcastPlatformMetrics(metrics: any) {
  if (!wss) return;
  
  const message = JSON.stringify({
    type: "platform_metrics",
    metrics,
    timestamp: new Date().toISOString()
  });
  
  wss.clients.forEach((client) => {
    const authClient = client as AuthenticatedWebSocket;
    
    // Only send to super admins
    if (client.readyState === WebSocket.OPEN && authClient.role === "super_admin") {
      client.send(message);
    }
  });
}

// Send alert to specific user
export function sendAlertToUser(userId: string, alert: any) {
  if (!wss) return;
  
  const message = JSON.stringify({
    type: "alert",
    alert,
    timestamp: new Date().toISOString()
  });
  
  wss.clients.forEach((client) => {
    const authClient = client as AuthenticatedWebSocket;
    
    if (client.readyState === WebSocket.OPEN && authClient.userId === userId) {
      client.send(message);
    }
  });
}

// Send notification to all users in a client
export function sendClientNotification(clientId: string, notification: any) {
  if (!wss) return;
  
  const message = JSON.stringify({
    type: "notification",
    notification,
    timestamp: new Date().toISOString()
  });
  
  wss.clients.forEach((client) => {
    const authClient = client as AuthenticatedWebSocket;
    
    if (client.readyState === WebSocket.OPEN && authClient.clientId === clientId) {
      client.send(message);
    }
  });
}