import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Mail, 
  MousePointer,
  Shield,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  RefreshCw,
  Download,
  Filter
} from 'lucide-react';
import { format } from 'date-fns';
import { queryClient } from '@/lib/queryClient';

interface CampaignStats {
  campaignId: string;
  campaignName: string;
  emailsSent: number;
  emailsOpened: number;
  linksClicked: number;
  phishingReported: number;
  openRate: number;
  clickRate: number;
  reportRate: number;
  avgTimeToClick: number;
  topClickedLinks: Array<{
    url: string;
    clicks: number;
  }>;
  userEngagement: Array<{
    userId: string;
    userName: string;
    email: string;
    opened: boolean;
    clicked: boolean;
    reported: boolean;
    openTime?: string;
    clickTime?: string;
    reportTime?: string;
  }>;
}

interface TrackingEvent {
  id: string;
  type: 'open' | 'click' | 'report';
  campaignId: string;
  userId: string;
  userEmail: string;
  timestamp: string;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    clickedUrl?: string;
  };
}

export function PhishingDashboard() {
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');
  const [refreshInterval, setRefreshInterval] = useState<number>(30000); // 30 seconds
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch campaigns
  const { data: campaigns } = useQuery({
    queryKey: ['/api/phishing-campaigns'],
    refetchInterval: autoRefresh ? refreshInterval : false
  });

  // Fetch campaign statistics
  const { data: stats, refetch: refetchStats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/phishing-campaigns/stats', selectedCampaign],
    enabled: !!selectedCampaign,
    refetchInterval: autoRefresh ? refreshInterval : false
  });

  // Fetch recent tracking events
  const { data: recentEvents, refetch: refetchEvents } = useQuery({
    queryKey: ['/api/phishing-campaigns/events', selectedCampaign],
    enabled: !!selectedCampaign,
    refetchInterval: autoRefresh ? 5000 : false // More frequent for real-time feel
  });

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        refetchStats();
        refetchEvents();
        queryClient.invalidateQueries({ queryKey: ['/api/phishing-campaigns'] });
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, refetchStats, refetchEvents]);

  const handleExportData = () => {
    // Export campaign data as CSV
    if (stats && stats.userEngagement) {
      const csv = [
        ['User', 'Email', 'Opened', 'Clicked', 'Reported', 'Open Time', 'Click Time', 'Report Time'],
        ...stats.userEngagement.map((user: any) => [
          user.userName,
          user.email,
          user.opened ? 'Yes' : 'No',
          user.clicked ? 'Yes' : 'No',
          user.reported ? 'Yes' : 'No',
          user.openTime || '',
          user.clickTime || '',
          user.reportTime || ''
        ])
      ].map(row => row.join(',')).join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `phishing-campaign-${selectedCampaign}-${Date.now()}.csv`;
      a.click();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Phishing Campaign Analytics
              </CardTitle>
              <CardDescription>
                Real-time tracking and analytics for phishing simulations
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={autoRefresh ? "default" : "outline"}
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
                data-testid="toggle-auto-refresh"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
                Auto Refresh: {autoRefresh ? 'ON' : 'OFF'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportData}
                disabled={!stats}
                data-testid="export-data"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                <SelectTrigger data-testid="campaign-selector">
                  <SelectValue placeholder="Select a campaign" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Campaigns</SelectItem>
                  {campaigns?.map((campaign: any) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.name} - {campaign.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Select value={String(refreshInterval)} onValueChange={(v) => setRefreshInterval(Number(v))}>
              <SelectTrigger className="w-[150px]" data-testid="refresh-interval">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5000">5 seconds</SelectItem>
                <SelectItem value="10000">10 seconds</SelectItem>
                <SelectItem value="30000">30 seconds</SelectItem>
                <SelectItem value="60000">1 minute</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-500" />
                Emails Sent
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="emails-sent">
                {stats.emailsSent}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Total campaign emails
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Eye className="w-4 h-4 text-green-500" />
                Open Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="open-rate">
                {stats.openRate.toFixed(1)}%
              </div>
              <Progress value={stats.openRate} className="mt-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {stats.emailsOpened} opened
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MousePointer className="w-4 h-4 text-orange-500" />
                Click Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="click-rate">
                {stats.clickRate.toFixed(1)}%
              </div>
              <Progress value={stats.clickRate} className="mt-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {stats.linksClicked} clicked
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-500" />
                Report Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="report-rate">
                {stats.reportRate.toFixed(1)}%
              </div>
              <Progress value={stats.reportRate} className="mt-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {stats.phishingReported} reported
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detailed Analytics Tabs */}
      <Tabs defaultValue="engagement" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="engagement" data-testid="tab-engagement">
            User Engagement
          </TabsTrigger>
          <TabsTrigger value="timeline" data-testid="tab-timeline">
            Event Timeline
          </TabsTrigger>
          <TabsTrigger value="links" data-testid="tab-links">
            Link Analysis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="engagement" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Engagement Details</CardTitle>
              <CardDescription>
                Track individual user interactions with the phishing simulation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {stats?.userEngagement?.map((user: any) => (
                    <div
                      key={user.userId}
                      className="flex items-center justify-between p-3 rounded-lg border"
                      data-testid={`user-engagement-${user.userId}`}
                    >
                      <div className="flex-1">
                        <p className="font-medium">{user.userName}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {user.opened && (
                          <Badge variant="secondary">
                            <Eye className="w-3 h-3 mr-1" />
                            Opened
                          </Badge>
                        )}
                        {user.clicked && (
                          <Badge variant="destructive">
                            <MousePointer className="w-3 h-3 mr-1" />
                            Clicked
                          </Badge>
                        )}
                        {user.reported && (
                          <Badge variant="default" className="bg-green-600">
                            <Shield className="w-3 h-3 mr-1" />
                            Reported
                          </Badge>
                        )}
                        {!user.opened && !user.clicked && !user.reported && (
                          <Badge variant="outline">
                            No Action
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Real-Time Event Timeline</CardTitle>
              <CardDescription>
                Live feed of user interactions with the phishing campaign
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {recentEvents?.map((event: TrackingEvent) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      data-testid={`event-${event.id}`}
                    >
                      <div className="mt-1">
                        {event.type === 'open' && <Eye className="w-4 h-4 text-blue-500" />}
                        {event.type === 'click' && <MousePointer className="w-4 h-4 text-orange-500" />}
                        {event.type === 'report' && <Shield className="w-4 h-4 text-green-500" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm">
                          <span className="font-medium">{event.userEmail}</span>
                          {event.type === 'open' && ' opened the email'}
                          {event.type === 'click' && ' clicked a phishing link'}
                          {event.type === 'report' && ' reported the email as phishing'}
                        </p>
                        {event.metadata?.clickedUrl && (
                          <p className="text-xs text-muted-foreground mt-1">
                            URL: {event.metadata.clickedUrl}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          <Clock className="w-3 h-3 inline mr-1" />
                          {format(new Date(event.timestamp), 'MMM d, h:mm:ss a')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="links" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Link Click Analysis</CardTitle>
              <CardDescription>
                Most clicked links in the phishing campaign
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats?.topClickedLinks?.map((link: any, index: number) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate flex-1" data-testid={`link-url-${index}`}>
                        {link.url}
                      </p>
                      <Badge variant="secondary">{link.clicks} clicks</Badge>
                    </div>
                    <Progress 
                      value={(link.clicks / stats.linksClicked) * 100} 
                      className="h-2"
                    />
                  </div>
                ))}
                {(!stats?.topClickedLinks || stats.topClickedLinks.length === 0) && (
                  <p className="text-center text-muted-foreground py-8">
                    No link clicks recorded yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Additional Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Response Time Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Average Time to Click</p>
                  <p className="text-2xl font-bold text-orange-500">
                    {stats?.avgTimeToClick ? `${Math.round(stats.avgTimeToClick / 60)} min` : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Fastest Click</p>
                  <p className="text-2xl font-bold text-red-500">
                    {stats?.fastestClick ? `${stats.fastestClick} sec` : 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Risk Assessment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            Risk Assessment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-lg bg-red-50 dark:bg-red-950">
              <p className="text-sm font-medium text-red-700 dark:text-red-300">High Risk</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {stats?.userEngagement?.filter((u: any) => u.clicked && !u.reported).length || 0}
              </p>
              <p className="text-xs text-red-600 dark:text-red-400">
                Users who clicked without reporting
              </p>
            </div>
            <div className="text-center p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950">
              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">Medium Risk</p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {stats?.userEngagement?.filter((u: any) => u.opened && !u.clicked && !u.reported).length || 0}
              </p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400">
                Users who opened but didn't interact
              </p>
            </div>
            <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-950">
              <p className="text-sm font-medium text-green-700 dark:text-green-300">Low Risk</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {stats?.userEngagement?.filter((u: any) => u.reported).length || 0}
              </p>
              <p className="text-xs text-green-600 dark:text-green-400">
                Users who reported the phishing
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}