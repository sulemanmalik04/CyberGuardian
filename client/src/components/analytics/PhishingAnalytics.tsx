import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Fish,
  Mail,
  Shield,
  AlertTriangle,
  Eye,
  MousePointer,
  Flag,
  TrendingUp,
  Users,
  BarChart3,
  Target,
  Crosshair,
  Activity,
  Clock
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  ScatterChart,
  Scatter
} from 'recharts';
import { api, type AnalyticsEvent, type User, type PhishingCampaign } from '@/lib/api';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { useAnalyticsWebSocket } from '@/hooks/use-websocket';

interface PhishingAnalyticsProps {
  dateRange?: string;
  filters?: {
    department?: string;
    campaignId?: string;
    riskLevel?: string;
  };
}

export default function PhishingAnalytics({ dateRange = '30', filters = {} }: PhishingAnalyticsProps) {
  const { user: currentUser } = useAuth();
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [viewType, setViewType] = useState('overview');
  
  // Real-time updates via WebSocket
  const { isConnected, latestEvent } = useAnalyticsWebSocket((event) => {
    // Handle real-time phishing event updates
    if (['email_opened', 'email_clicked', 'phishing_reported'].includes(event.eventType)) {
      console.log('Real-time phishing event:', event);
    }
  });

  // Date range calculation
  const getDateRange = () => {
    const end = endOfDay(new Date());
    let start: Date;
    
    switch (dateRange) {
      case '7':
        start = startOfDay(subDays(end, 7));
        break;
      case '90':
        start = startOfDay(subDays(end, 90));
        break;
      case '365':
        start = startOfDay(subDays(end, 365));
        break;
      default:
        start = startOfDay(subDays(end, 30));
    }
    
    return {
      start: start.toISOString(),
      end: end.toISOString()
    };
  };

  const { start: rangeStart, end: rangeEnd } = getDateRange();

  // Data fetching
  const { data: analyticsEvents = [] } = useQuery({
    queryKey: ['analytics', currentUser?.clientId, rangeStart, rangeEnd],
    queryFn: () => api.getAnalytics(
      currentUser?.role === 'super_admin' ? filters.department : currentUser?.clientId,
      rangeStart,
      rangeEnd
    ),
    enabled: !!currentUser
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users', currentUser?.clientId],
    queryFn: () => api.getUsers(currentUser?.clientId),
    enabled: !!currentUser
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns', currentUser?.clientId],
    queryFn: () => api.getCampaigns(currentUser?.clientId),
    enabled: !!currentUser
  });

  // Filter phishing-related events
  const phishingEvents = analyticsEvents.filter(e => 
    ['email_sent', 'email_opened', 'email_clicked', 'phishing_reported'].includes(e.eventType)
  );

  // Chart colors
  const chartColors = {
    primary: '#3b82f6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#06b6d4',
    purple: '#8b5cf6',
    orange: '#f97316'
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-sm mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
              {entry.name.includes('Rate') ? '%' : ''}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Calculate phishing metrics
  const totalEmailsSent = phishingEvents.filter(e => e.eventType === 'email_sent').length;
  const emailsOpened = phishingEvents.filter(e => e.eventType === 'email_opened').length;
  const emailsClicked = phishingEvents.filter(e => e.eventType === 'email_clicked').length;
  const emailsReported = phishingEvents.filter(e => e.eventType === 'phishing_reported').length;
  
  const phishingMetrics = {
    totalEmailsSent,
    emailsOpened,
    emailsClicked,
    emailsReported,
    openRate: calculateOpenRate(totalEmailsSent, emailsOpened),
    clickRate: calculateClickRate(totalEmailsSent, emailsClicked),
    reportRate: calculateReportRate(emailsClicked, emailsReported),
    vulnerabilityScore: calculateVulnerabilityScore(totalEmailsSent, emailsClicked, emailsReported)
  };

  function calculateOpenRate(sent: number, opened: number): number {
    return sent > 0 ? Math.round((opened / sent) * 100 * 10) / 10 : 0;
  }

  function calculateClickRate(sent: number, clicked: number): number {
    return sent > 0 ? Math.round((clicked / sent) * 100 * 10) / 10 : 0;
  }

  function calculateReportRate(clicked: number, reported: number): number {
    return clicked > 0 ? Math.round((reported / clicked) * 100 * 10) / 10 : 0;
  }

  function calculateVulnerabilityScore(sent: number, clicked: number, reported: number): number {
    const clickRate = calculateClickRate(sent, clicked);
    const reportRate = calculateReportRate(clicked, reported);
    
    // Higher click rate = higher vulnerability, higher report rate = lower vulnerability
    const vulnerabilityScore = clickRate - (reportRate * 0.5);
    return Math.max(0, Math.min(100, Math.round(vulnerabilityScore * 10) / 10));
  }

  // Campaign performance data
  const campaignPerformanceData = getCampaignPerformanceData();

  function getCampaignPerformanceData() {
    const campaignMap = new Map();
    
    campaigns.forEach(campaign => {
      const campaignEvents = phishingEvents.filter(e => e.campaignId === campaign.id);
      const sent = campaignEvents.filter(e => e.eventType === 'email_sent').length;
      const opened = campaignEvents.filter(e => e.eventType === 'email_opened').length;
      const clicked = campaignEvents.filter(e => e.eventType === 'email_clicked').length;
      const reported = campaignEvents.filter(e => e.eventType === 'phishing_reported').length;
      
      const openRate = sent > 0 ? Math.round((opened / sent) * 100 * 10) / 10 : 0;
      const clickRate = sent > 0 ? Math.round((clicked / sent) * 100 * 10) / 10 : 0;
      const reportRate = clicked > 0 ? Math.round((reported / clicked) * 100 * 10) / 10 : 0;
      
      campaignMap.set(campaign.id, {
        name: campaign.name,
        status: campaign.status,
        sent,
        opened,
        clicked,
        reported,
        openRate,
        clickRate,
        reportRate,
        effectiveness: reportRate - clickRate // Higher is better
      });
    });
    
    return Array.from(campaignMap.values()).sort((a, b) => b.effectiveness - a.effectiveness);
  }

  // Time series data for phishing trends
  const phishingTrendsData = getPhishingTrendsData();

  function getPhishingTrendsData() {
    const days = [];
    const startTime = new Date(rangeStart);
    const endTime = new Date(rangeEnd);
    
    for (let d = new Date(startTime); d <= endTime; d.setDate(d.getDate() + 1)) {
      const dayStart = startOfDay(d).getTime();
      const dayEnd = endOfDay(d).getTime();
      
      const dayEvents = phishingEvents.filter(e => {
        const eventTime = new Date(e.timestamp).getTime();
        return eventTime >= dayStart && eventTime <= dayEnd;
      });
      
      const sent = dayEvents.filter(e => e.eventType === 'email_sent').length;
      const opened = dayEvents.filter(e => e.eventType === 'email_opened').length;
      const clicked = dayEvents.filter(e => e.eventType === 'email_clicked').length;
      const reported = dayEvents.filter(e => e.eventType === 'phishing_reported').length;
      
      days.push({
        date: format(d, 'MMM dd'),
        sent,
        opened,
        clicked,
        reported,
        clickRate: sent > 0 ? Math.round((clicked / sent) * 100 * 10) / 10 : 0,
        reportRate: clicked > 0 ? Math.round((reported / clicked) * 100 * 10) / 10 : 0
      });
    }
    
    return days;
  }

  // Department vulnerability analysis
  const departmentVulnerabilityData = getDepartmentVulnerabilityData();

  function getDepartmentVulnerabilityData() {
    const deptMap = new Map();
    
    users.forEach(user => {
      const dept = user.department || 'No Department';
      if (!deptMap.has(dept)) {
        deptMap.set(dept, { 
          name: dept, 
          users: 0, 
          emailsSent: 0, 
          emailsClicked: 0, 
          emailsReported: 0 
        });
      }
      
      const userEvents = phishingEvents.filter(e => e.userId === user.id);
      const sent = userEvents.filter(e => e.eventType === 'email_sent').length;
      const clicked = userEvents.filter(e => e.eventType === 'email_clicked').length;
      const reported = userEvents.filter(e => e.eventType === 'phishing_reported').length;
      
      const deptData = deptMap.get(dept);
      deptData.users++;
      deptData.emailsSent += sent;
      deptData.emailsClicked += clicked;
      deptData.emailsReported += reported;
    });
    
    return Array.from(deptMap.values()).map(dept => ({
      ...dept,
      clickRate: dept.emailsSent > 0 ? Math.round((dept.emailsClicked / dept.emailsSent) * 100 * 10) / 10 : 0,
      reportRate: dept.emailsClicked > 0 ? Math.round((dept.emailsReported / dept.emailsClicked) * 100 * 10) / 10 : 0,
      riskScore: dept.emailsSent > 0 ? 
        Math.max(0, Math.round(((dept.emailsClicked / dept.emailsSent) * 100 - 
        (dept.emailsReported / Math.max(1, dept.emailsClicked)) * 50) * 10) / 10) : 0
    })).sort((a, b) => b.riskScore - a.riskScore);
  }

  // User vulnerability analysis
  const userVulnerabilityData = getUserVulnerabilityData();

  function getUserVulnerabilityData() {
    return users.map(user => {
      const userEvents = phishingEvents.filter(e => e.userId === user.id);
      const emailsSent = userEvents.filter(e => e.eventType === 'email_sent').length;
      const emailsClicked = userEvents.filter(e => e.eventType === 'email_clicked').length;
      const emailsReported = userEvents.filter(e => e.eventType === 'phishing_reported').length;
      
      const clickRate = emailsSent > 0 ? Math.round((emailsClicked / emailsSent) * 100 * 10) / 10 : 0;
      const reportRate = emailsClicked > 0 ? Math.round((emailsReported / emailsClicked) * 100 * 10) / 10 : 0;
      
      // Calculate risk level based on behavior
      let riskLevel = 'Low Risk';
      if (emailsClicked > 2 || clickRate > 50) riskLevel = 'High Risk';
      else if (emailsClicked > 0 || clickRate > 20) riskLevel = 'Medium Risk';
      
      const lastActivity = userEvents.length > 0 
        ? new Date(Math.max(...userEvents.map(e => new Date(e.timestamp).getTime())))
        : null;
      
      return {
        ...user,
        emailsSent,
        emailsClicked,
        emailsReported,
        clickRate,
        reportRate,
        riskLevel,
        lastActivity
      };
    }).filter(user => user.emailsSent > 0).sort((a, b) => b.clickRate - a.clickRate);
  }

  // Attack vector analysis
  const attackVectorData = getAttackVectorData();

  function getAttackVectorData() {
    const vectorMap = new Map();
    
    phishingEvents.forEach(event => {
      if (event.eventType === 'email_clicked' && event.metadata?.attackVector) {
        const vector = event.metadata.attackVector;
        if (!vectorMap.has(vector)) {
          vectorMap.set(vector, { name: vector, clicks: 0, reports: 0 });
        }
        vectorMap.get(vector).clicks++;
      }
      
      if (event.eventType === 'phishing_reported' && event.metadata?.attackVector) {
        const vector = event.metadata.attackVector;
        if (!vectorMap.has(vector)) {
          vectorMap.set(vector, { name: vector, clicks: 0, reports: 0 });
        }
        vectorMap.get(vector).reports++;
      }
    });
    
    return Array.from(vectorMap.values()).map(vector => ({
      ...vector,
      successRate: vector.clicks > 0 ? Math.round((vector.clicks / (vector.clicks + vector.reports)) * 100) : 0
    }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center space-x-2" data-testid="heading-phishing-analytics">
            <Fish className="w-6 h-6" />
            <span>Phishing Analytics</span>
          </h2>
          <p className="text-muted-foreground mt-1">
            Security awareness assessment through simulated phishing campaigns
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
            <SelectTrigger className="w-48" data-testid="select-campaign">
              <SelectValue placeholder="All Campaigns" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Campaigns</SelectItem>
              {campaigns.map(campaign => (
                <SelectItem key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
            <SelectTrigger className="w-36" data-testid="select-department">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Departments</SelectItem>
              {Array.from(new Set(users.map(u => u.department).filter(Boolean))).map(dept => (
                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Phishing Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Click Rate</p>
                <p className="text-2xl font-bold text-danger" data-testid="metric-click-rate">
                  {phishingMetrics.clickRate}%
                </p>
              </div>
              <div className="w-12 h-12 bg-danger/10 rounded-lg flex items-center justify-center">
                <MousePointer className="text-danger text-xl" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              {phishingMetrics.emailsClicked} of {phishingMetrics.totalEmailsSent} emails
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Report Rate</p>
                <p className="text-2xl font-bold text-success" data-testid="metric-report-rate">
                  {phishingMetrics.reportRate}%
                </p>
              </div>
              <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center">
                <Flag className="text-success text-xl" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              {phishingMetrics.emailsReported} reported as suspicious
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Open Rate</p>
                <p className="text-2xl font-bold text-info" data-testid="metric-open-rate">
                  {phishingMetrics.openRate}%
                </p>
              </div>
              <div className="w-12 h-12 bg-info/10 rounded-lg flex items-center justify-center">
                <Eye className="text-info text-xl" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Email engagement rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Vulnerability Score</p>
                <p className="text-2xl font-bold text-warning" data-testid="metric-vulnerability-score">
                  {phishingMetrics.vulnerabilityScore}
                </p>
              </div>
              <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center">
                <AlertTriangle className="text-warning text-xl" />
              </div>
            </div>
            <Progress value={phishingMetrics.vulnerabilityScore} className="mt-4 h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Analytics Tabs */}
      <Tabs value={viewType} onValueChange={setViewType} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <BarChart3 className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="campaigns" data-testid="tab-campaigns">
            <Target className="w-4 h-4 mr-2" />
            Campaign Analysis
          </TabsTrigger>
          <TabsTrigger value="vulnerability" data-testid="tab-vulnerability">
            <Shield className="w-4 h-4 mr-2" />
            Vulnerability Assessment
          </TabsTrigger>
          <TabsTrigger value="trends" data-testid="tab-trends">
            <TrendingUp className="w-4 h-4 mr-2" />
            Trends & Patterns
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="w-5 h-5" />
                  <span>Phishing Campaign Results</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={phishingTrendsData}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar
                        dataKey="sent"
                        fill={chartColors.info}
                        name="Emails Sent"
                        radius={[2, 2, 0, 0]}
                      />
                      <Bar
                        dataKey="clicked"
                        fill={chartColors.danger}
                        name="Emails Clicked"
                        radius={[2, 2, 0, 0]}
                      />
                      <Bar
                        dataKey="reported"
                        fill={chartColors.success}
                        name="Emails Reported"
                        radius={[2, 2, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Crosshair className="w-5 h-5" />
                  <span>Department Risk Assessment</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={departmentVulnerabilityData.slice(0, 8)}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar
                        dataKey="clickRate"
                        fill={chartColors.danger}
                        name="Click Rate (%)"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="reportRate"
                        fill={chartColors.success}
                        name="Report Rate (%)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Target className="w-5 h-5" />
                <span>Campaign Performance Analysis</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-4 font-medium text-sm">Campaign</th>
                      <th className="text-left p-4 font-medium text-sm">Status</th>
                      <th className="text-left p-4 font-medium text-sm">Sent</th>
                      <th className="text-left p-4 font-medium text-sm">Opened</th>
                      <th className="text-left p-4 font-medium text-sm">Clicked</th>
                      <th className="text-left p-4 font-medium text-sm">Reported</th>
                      <th className="text-left p-4 font-medium text-sm">Click Rate</th>
                      <th className="text-left p-4 font-medium text-sm">Report Rate</th>
                      <th className="text-left p-4 font-medium text-sm">Effectiveness</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaignPerformanceData.map((campaign, index) => (
                      <tr key={index} className="border-t border-border hover:bg-muted/30">
                        <td className="p-4">
                          <div className="font-medium">{campaign.name}</div>
                        </td>
                        <td className="p-4">
                          <Badge 
                            variant={
                              campaign.status === 'completed' ? 'default' : 
                              campaign.status === 'active' ? 'destructive' : 'secondary'
                            }
                          >
                            {campaign.status}
                          </Badge>
                        </td>
                        <td className="p-4 font-medium">{campaign.sent}</td>
                        <td className="p-4 font-medium text-info">{campaign.opened}</td>
                        <td className="p-4 font-medium text-danger">{campaign.clicked}</td>
                        <td className="p-4 font-medium text-success">{campaign.reported}</td>
                        <td className="p-4">
                          <span className="text-danger font-medium">{campaign.clickRate}%</span>
                        </td>
                        <td className="p-4">
                          <span className="text-success font-medium">{campaign.reportRate}%</span>
                        </td>
                        <td className="p-4">
                          <Badge 
                            variant={
                              campaign.effectiveness > 50 ? 'default' : 
                              campaign.effectiveness > 0 ? 'secondary' : 'destructive'
                            }
                          >
                            {campaign.effectiveness > 0 ? 'Good' : campaign.effectiveness < -20 ? 'Poor' : 'Fair'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vulnerability" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="w-5 h-5" />
                  <span>High-Risk Users</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-4 font-medium text-sm">User</th>
                        <th className="text-left p-4 font-medium text-sm">Department</th>
                        <th className="text-left p-4 font-medium text-sm">Click Rate</th>
                        <th className="text-left p-4 font-medium text-sm">Risk Level</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userVulnerabilityData.slice(0, 10).map((user) => (
                        <tr key={user.id} className="border-t border-border hover:bg-muted/30">
                          <td className="p-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                                <span className="text-primary-foreground font-medium text-sm">
                                  {user.firstName[0]}{user.lastName[0]}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-sm">{user.firstName} {user.lastName}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge variant="outline" className="text-xs">
                              {user.department || 'No Dept'}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <span className="text-danger font-medium">{user.clickRate}%</span>
                          </td>
                          <td className="p-4">
                            <Badge 
                              className={
                                user.riskLevel === 'High Risk' ? 'bg-red-100 text-red-800' :
                                user.riskLevel === 'Medium Risk' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-green-100 text-green-800'
                              }
                            >
                              {user.riskLevel}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="w-5 h-5" />
                  <span>Attack Vector Analysis</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={attackVectorData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="clicks"
                      >
                        {attackVectorData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={Object.values(chartColors)[index % Object.values(chartColors).length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value, name) => [value, name]}
                        labelFormatter={() => ''}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5" />
                  <span>Click Rate Trends</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={phishingTrendsData}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="clickRate"
                        stroke={chartColors.danger}
                        strokeWidth={3}
                        name="Click Rate (%)"
                        dot={{ fill: chartColors.danger, strokeWidth: 2, r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="reportRate"
                        stroke={chartColors.success}
                        strokeWidth={3}
                        name="Report Rate (%)"
                        dot={{ fill: chartColors.success, strokeWidth: 2, r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="w-5 h-5" />
                  <span>Response Time Analysis</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={phishingTrendsData}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="opened"
                        stackId="1"
                        stroke={chartColors.info}
                        fill={chartColors.info}
                        fillOpacity={0.4}
                        name="Emails Opened"
                      />
                      <Area
                        type="monotone"
                        dataKey="clicked"
                        stackId="1"
                        stroke={chartColors.danger}
                        fill={chartColors.danger}
                        fillOpacity={0.6}
                        name="Links Clicked"
                      />
                      <Area
                        type="monotone"
                        dataKey="reported"
                        stackId="1"
                        stroke={chartColors.success}
                        fill={chartColors.success}
                        fillOpacity={0.8}
                        name="Phishing Reported"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}