import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Activity,
  AlertCircle,
  CheckCircle,
  UserCheck,
  Mail,
  MousePointer,
  Flag,
  BookOpen,
  Award,
  LogIn,
  Clock,
  Filter,
  RefreshCw,
  Bell,
  TrendingUp,
  ChevronRight
} from 'lucide-react';
import { api, type AnalyticsEvent } from '@/lib/api';
import { format, formatDistanceToNow } from 'date-fns';
import { useAnalyticsWebSocket } from '@/hooks/use-websocket';
import { formatActivityFeedItem } from '@/lib/export-utils';

interface ActivityFeedProps {
  maxItems?: number;
  showFilters?: boolean;
  autoRefresh?: boolean;
  className?: string;
}

export default function ActivityFeed({ 
  maxItems = 50, 
  showFilters = true,
  autoRefresh = true,
  className = ''
}: ActivityFeedProps) {
  const { user: currentUser } = useAuth();
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [realTimeEvents, setRealTimeEvents] = useState<AnalyticsEvent[]>([]);

  // WebSocket for real-time updates
  const { latestEvent } = useAnalyticsWebSocket((event) => {
    // Add new event to the top of the feed
    setRealTimeEvents(prev => [event, ...prev].slice(0, maxItems));
  });

  // Fetch recent events
  const { data: recentEvents = [], isLoading, refetch } = useQuery({
    queryKey: ['recent-analytics', currentUser?.clientId],
    queryFn: async () => {
      const endDate = new Date().toISOString();
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // Last 24 hours
      
      const events = await api.getAnalytics(
        currentUser?.role === 'super_admin' ? undefined : currentUser?.clientId,
        startDate,
        endDate
      );
      
      // Sort by timestamp descending
      return events.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ).slice(0, maxItems);
    },
    enabled: !!currentUser,
    refetchInterval: autoRefresh ? 30000 : false // Refresh every 30 seconds
  });

  // Combine real-time and fetched events
  const allEvents = [...realTimeEvents, ...recentEvents]
    .filter((event, index, self) => 
      index === self.findIndex(e => e.id === event.id)
    )
    .sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    .slice(0, maxItems);

  // Filter events
  const filteredEvents = allEvents.filter(event => {
    // Type filter
    if (filterType !== 'all' && event.eventType !== filterType) return false;
    
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const metadata = JSON.stringify(event.metadata).toLowerCase();
      return metadata.includes(searchLower) || 
             event.eventType.toLowerCase().includes(searchLower);
    }
    
    return true;
  });

  // Get icon and color for event type
  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'login':
        return { icon: LogIn, color: 'text-blue-500' };
      case 'course_completed':
        return { icon: Award, color: 'text-green-500' };
      case 'quiz_completed':
        return { icon: BookOpen, color: 'text-purple-500' };
      case 'email_opened':
        return { icon: Mail, color: 'text-orange-500' };
      case 'email_clicked':
        return { icon: MousePointer, color: 'text-red-500' };
      case 'phishing_reported':
        return { icon: Flag, color: 'text-green-600' };
      case 'user_created':
        return { icon: UserCheck, color: 'text-blue-600' };
      case 'security_incident':
        return { icon: AlertCircle, color: 'text-red-600' };
      default:
        return { icon: Activity, color: 'text-gray-500' };
    }
  };

  // Format event for display
  const formatEvent = (event: AnalyticsEvent) => {
    const { icon: Icon, color } = getEventIcon(event.eventType);
    const timeAgo = formatDistanceToNow(new Date(event.timestamp), { addSuffix: true });
    
    let description = formatActivityFeedItem(event);
    
    // Add user info if available
    if (event.metadata?.userEmail) {
      description = `${event.metadata.userEmail}: ${description}`;
    }
    
    return {
      id: event.id,
      icon: Icon,
      color,
      title: event.eventType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      description,
      timeAgo,
      timestamp: event.timestamp,
      metadata: event.metadata
    };
  };

  const formattedEvents = filteredEvents.map(formatEvent);

  // Group events by time periods
  const groupEventsByTime = (events: typeof formattedEvents) => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    return {
      recent: events.filter(e => new Date(e.timestamp) > oneHourAgo),
      today: events.filter(e => {
        const eventTime = new Date(e.timestamp);
        return eventTime <= oneHourAgo && eventTime > sixHoursAgo;
      }),
      earlier: events.filter(e => {
        const eventTime = new Date(e.timestamp);
        return eventTime <= sixHoursAgo && eventTime > oneDayAgo;
      }),
      yesterday: events.filter(e => new Date(e.timestamp) <= oneDayAgo)
    };
  };

  const groupedEvents = groupEventsByTime(formattedEvents);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Activity Feed
            {realTimeEvents.length > 0 && (
              <Badge variant="secondary" className="animate-pulse">
                {realTimeEvents.length} new
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              data-testid="button-refresh-feed"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {showFilters && (
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Search events..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
              data-testid="input-search-events"
            />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-40" data-testid="select-event-type">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="login">Logins</SelectItem>
                <SelectItem value="course_completed">Courses</SelectItem>
                <SelectItem value="quiz_completed">Quizzes</SelectItem>
                <SelectItem value="email_opened">Email Opens</SelectItem>
                <SelectItem value="email_clicked">Email Clicks</SelectItem>
                <SelectItem value="phishing_reported">Phishing Reports</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        
        <ScrollArea className="h-[500px]">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
                  <div className="w-8 h-8 bg-gray-200 rounded-full" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : formattedEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No activity to display</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedEvents.recent.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                    Last Hour
                  </h3>
                  <div className="space-y-2">
                    {groupedEvents.recent.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors"
                        data-testid={`event-item-${event.id}`}
                      >
                        <div className={`mt-0.5 ${event.color}`}>
                          <event.icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {event.title}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {event.timeAgo}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {event.description}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-50" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {groupedEvents.today.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                    Today
                  </h3>
                  <div className="space-y-2">
                    {groupedEvents.today.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors"
                        data-testid={`event-item-${event.id}`}
                      >
                        <div className={`mt-0.5 ${event.color}`}>
                          <event.icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {event.title}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {event.timeAgo}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {event.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {groupedEvents.earlier.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                    Earlier Today
                  </h3>
                  <div className="space-y-2">
                    {groupedEvents.earlier.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors opacity-75"
                        data-testid={`event-item-${event.id}`}
                      >
                        <div className={`mt-0.5 ${event.color}`}>
                          <event.icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {event.title}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {event.timeAgo}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {event.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}