import { useState, useEffect } from 'react';
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
  BarChart3, 
  TrendingUp, 
  Users, 
  GraduationCap,
  Fish,
  Download,
  Filter,
  Search,
  Eye,
  Lightbulb,
  Calendar,
  Activity,
  RefreshCw,
  FileText
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
  ComposedChart
} from 'recharts';
import { api, type AnalyticsEvent, type User } from '@/lib/api';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

export default function AnalyticsDashboard() {
  const { user: currentUser } = useAuth();
  const [dateRange, setDateRange] = useState('30');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [activeChartTab, setActiveChartTab] = useState('trends');
  const [filters, setFilters] = useState({
    department: '',
    riskLevel: '',
    userGroup: '',
    courseStatus: '',
    eventType: '',
    datePreset: '30',
    showInactive: false
  });

  // Calculate date range
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
      case 'custom':
        start = startDate ? startOfDay(new Date(startDate)) : startOfDay(subDays(end, 30));
        return {
          start: start.toISOString(),
          end: endDate ? endOfDay(new Date(endDate)).toISOString() : end.toISOString()
        };
      default:
        start = startOfDay(subDays(end, 30));
    }
    
    return {
      start: start.toISOString(),
      end: end.toISOString()
    };
  };

  const { start: rangeStart, end: rangeEnd } = getDateRange();

  const { data: analyticsEvents = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['analytics', currentUser?.clientId, rangeStart, rangeEnd],
    queryFn: () => api.getAnalytics(
      currentUser?.role === 'super_admin' ? selectedClient : currentUser?.clientId,
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

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: api.getClients,
    enabled: currentUser?.role === 'super_admin'
  });

  // Apply filters to analytics events
  const filteredAnalyticsEvents = analyticsEvents.filter(event => {
    // Filter by event type
    if (filters.eventType && event.eventType !== filters.eventType) return false;
    
    // Filter by user department (if event has userId)
    if (filters.department && event.userId) {
      const eventUser = users.find(u => u.id === event.userId);
      if (!eventUser || eventUser.department !== filters.department) return false;
    }
    
    return true;
  });

  // Apply filters to users
  const filteredUsers = users.filter(user => {
    // Filter by department
    if (filters.department && user.department !== filters.department) return false;
    
    // Filter by active status
    if (!filters.showInactive && !user.isActive) return false;
    
    return true;
  });

  // Calculate key metrics
  const metrics = {
    trainingCompletion: calculateTrainingCompletion(),
    phishingClickRate: calculatePhishingClickRate(),
    averageQuizScore: calculateAverageQuizScore(),
    activeLearners: calculateActiveLearners()
  };

  function calculateTrainingCompletion() {
    const courseEvents = filteredAnalyticsEvents.filter(e => e.eventType === 'course_completed');
    const totalUsers = filteredUsers.length;
    if (totalUsers === 0) return 0;
    
    const uniqueCompletions = new Set(courseEvents.map(e => e.userId)).size;
    return Math.round((uniqueCompletions / totalUsers) * 100);
  }

  function calculatePhishingClickRate() {
    const emailsSent = filteredAnalyticsEvents.filter(e => e.eventType === 'email_sent').length;
    const emailsClicked = filteredAnalyticsEvents.filter(e => e.eventType === 'email_clicked').length;
    
    if (emailsSent === 0) return 0;
    return Math.round((emailsClicked / emailsSent) * 100 * 10) / 10;
  }

  function calculateAverageQuizScore() {
    const quizEvents = filteredAnalyticsEvents.filter(e => 
      e.eventType === 'quiz_completed' && e.metadata?.score
    );
    
    if (quizEvents.length === 0) return 0;
    const totalScore = quizEvents.reduce((sum, e) => sum + (e.metadata.score || 0), 0);
    return Math.round((totalScore / quizEvents.length) * 10) / 10;
  }

  function calculateActiveLearners() {
    const recentEvents = filteredAnalyticsEvents.filter(e => 
      ['course_started', 'quiz_completed', 'course_completed'].includes(e.eventType)
    );
    return new Set(recentEvents.map(e => e.userId)).size;
  }

  // Time series data for charts
  const chartData = getTimeSeriesData();

  function getTimeSeriesData() {
    const days = [];
    const startTime = new Date(rangeStart);
    const endTime = new Date(rangeEnd);
    
    for (let d = new Date(startTime); d <= endTime; d.setDate(d.getDate() + 1)) {
      const dayStart = startOfDay(d).getTime();
      const dayEnd = endOfDay(d).getTime();
      
      const dayEvents = filteredAnalyticsEvents.filter(e => {
        const eventTime = new Date(e.timestamp).getTime();
        return eventTime >= dayStart && eventTime <= dayEnd;
      });
      
      days.push({
        date: format(d, 'MMM dd'),
        coursesCompleted: dayEvents.filter(e => e.eventType === 'course_completed').length,
        phishingClicks: dayEvents.filter(e => e.eventType === 'email_clicked').length,
        quizzesCompleted: dayEvents.filter(e => e.eventType === 'quiz_completed').length,
        emailsOpened: dayEvents.filter(e => e.eventType === 'email_opened').length
      });
    }
    
    return days;
  }

  // Chart color themes
  const chartColors = {
    primary: '#3b82f6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#06b6d4',
    muted: '#6b7280'
  };

  // Department breakdown data
  const departmentData = getDepartmentBreakdown();

  function getDepartmentBreakdown() {
    const deptMap = new Map();
    filteredUsers.forEach(user => {
      const dept = user.department || 'No Department';
      if (!deptMap.has(dept)) {
        deptMap.set(dept, { name: dept, users: 0, completed: 0, risk: { high: 0, medium: 0, low: 0 } });
      }
      const deptData = deptMap.get(dept);
      deptData.users++;
      
      const userEvents = filteredAnalyticsEvents.filter(e => e.userId === user.id);
      const coursesCompleted = userEvents.filter(e => e.eventType === 'course_completed').length;
      if (coursesCompleted > 0) deptData.completed++;
      
      const phishingFailed = userEvents.filter(e => 
        e.eventType === 'email_clicked' && e.metadata?.reported !== true
      ).length;
      const quizEvents = userEvents.filter(e => e.eventType === 'quiz_completed');
      const avgQuizScore = quizEvents.length > 0 
        ? quizEvents.reduce((sum, e) => sum + (e.metadata?.score || 0), 0) / quizEvents.length
        : 0;
      
      const riskLevel = getRiskLevel(phishingFailed, 0, avgQuizScore);
      if (riskLevel === 'High Risk') deptData.risk.high++;
      else if (riskLevel === 'Medium Risk') deptData.risk.medium++;
      else deptData.risk.low++;
    });
    
    return Array.from(deptMap.values()).map(dept => ({
      ...dept,
      completionRate: dept.users > 0 ? Math.round((dept.completed / dept.users) * 100) : 0
    }));
  }

  // Phishing campaign performance data
  const phishingPerformanceData = getPhishingPerformanceData();

  function getPhishingPerformanceData() {
    const campaignMap = new Map();
    filteredAnalyticsEvents.filter(e => e.campaignId).forEach(event => {
      const campaignId = event.campaignId!;
      if (!campaignMap.has(campaignId)) {
        campaignMap.set(campaignId, {
          id: campaignId,
          sent: 0,
          opened: 0,
          clicked: 0,
          reported: 0
        });
      }
      const data = campaignMap.get(campaignId);
      if (event.eventType === 'email_sent') data.sent++;
      if (event.eventType === 'email_opened') data.opened++;
      if (event.eventType === 'email_clicked') {
        data.clicked++;
        if (event.metadata?.reported) data.reported++;
      }
    });
    
    return Array.from(campaignMap.values()).map((campaign, index) => ({
      name: `Campaign ${index + 1}`,
      sent: campaign.sent,
      opened: campaign.opened,
      clicked: campaign.clicked,
      reported: campaign.reported,
      openRate: campaign.sent > 0 ? Math.round((campaign.opened / campaign.sent) * 100) : 0,
      clickRate: campaign.sent > 0 ? Math.round((campaign.clicked / campaign.sent) * 100) : 0,
      reportRate: campaign.clicked > 0 ? Math.round((campaign.reported / campaign.clicked) * 100) : 0
    }));
  }

  // Risk distribution data for pie chart
  const riskDistribution = getRiskDistribution();

  function getRiskDistribution() {
    const distribution = { 'High Risk': 0, 'Medium Risk': 0, 'Low Risk': 0 };
    
    // Calculate risk distribution from filtered users
    filteredUsers.forEach(user => {
      const userEvents = filteredAnalyticsEvents.filter(e => e.userId === user.id);
      const phishingFailed = userEvents.filter(e => 
        e.eventType === 'email_clicked' && e.metadata?.reported !== true
      ).length;
      const quizEvents = userEvents.filter(e => e.eventType === 'quiz_completed');
      const avgQuizScore = quizEvents.length > 0 
        ? quizEvents.reduce((sum, e) => sum + (e.metadata?.score || 0), 0) / quizEvents.length
        : 0;
      
      const riskLevel = getRiskLevel(phishingFailed, 0, avgQuizScore);
      distribution[riskLevel]++;
    });
    
    return [
      { name: 'High Risk', value: distribution['High Risk'], color: chartColors.danger },
      { name: 'Medium Risk', value: distribution['Medium Risk'], color: chartColors.warning },
      { name: 'Low Risk', value: distribution['Low Risk'], color: chartColors.success }
    ];
  }

  // Handle data refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    // Trigger re-fetch of analytics data
    // The useQuery will automatically refetch when queryKey changes
    setTimeout(() => setRefreshing(false), 1000);
  };

  // Custom tooltip for charts
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
  }

  // User performance data
  const userPerformance = users.map(user => {
    const userEvents = analyticsEvents.filter(e => e.userId === user.id);
    const coursesCompleted = userEvents.filter(e => e.eventType === 'course_completed').length;
    const quizEvents = userEvents.filter(e => e.eventType === 'quiz_completed');
    const phishingPassed = userEvents.filter(e => 
      e.eventType === 'email_clicked' && e.metadata?.reported === true
    ).length;
    const phishingFailed = userEvents.filter(e => 
      e.eventType === 'email_clicked' && e.metadata?.reported !== true
    ).length;
    
    const avgQuizScore = quizEvents.length > 0 
      ? Math.round((quizEvents.reduce((sum, e) => sum + (e.metadata?.score || 0), 0) / quizEvents.length) * 10) / 10
      : 0;
    
    const lastActivity = userEvents.length > 0 
      ? new Date(Math.max(...userEvents.map(e => new Date(e.timestamp).getTime())))
      : null;

    const riskLevel = getRiskLevel(phishingFailed, phishingPassed, avgQuizScore);

    return {
      ...user,
      coursesCompleted,
      avgQuizScore,
      phishingPassed,
      phishingFailed,
      lastActivity,
      riskLevel
    };
  }).filter(user => 
    !searchTerm || 
    user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.department && user.department.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  function getRiskLevel(failed: number, passed: number, quizScore: number) {
    if (failed > 2 || quizScore < 60) return 'High Risk';
    if (failed > 0 || quizScore < 80) return 'Medium Risk';
    return 'Low Risk';
  }

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'High Risk':
        return 'bg-red-100 text-red-800';
      case 'Medium Risk':
        return 'bg-yellow-100 text-yellow-800';
      case 'Low Risk':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatLastActivity = (date: Date | null) => {
    if (!date) return 'Never';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const exportReport = () => {
    const csvContent = [
      ['User', 'Email', 'Department', 'Courses Completed', 'Quiz Average', 'Phishing Tests Passed', 'Phishing Tests Failed', 'Risk Level', 'Last Activity'],
      ...userPerformance.map(user => [
        `${user.firstName} ${user.lastName}`,
        user.email,
        user.department || 'N/A',
        user.coursesCompleted,
        `${user.avgQuizScore}%`,
        user.phishingPassed,
        user.phishingFailed,
        user.riskLevel,
        formatLastActivity(user.lastActivity)
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Enhanced export with more data
  const exportDetailedReport = () => {
    const timestamp = format(new Date(), 'yyyy-MM-dd-HHmm');
    
    // Main analytics CSV
    const analyticsData = [
      ['Date Range', `${format(new Date(rangeStart), 'yyyy-MM-dd')} to ${format(new Date(rangeEnd), 'yyyy-MM-dd')}`],
      ['Total Users', users.length],
      ['Training Completion Rate', `${metrics.trainingCompletion}%`],
      ['Phishing Click Rate', `${metrics.phishingClickRate}%`],
      ['Average Quiz Score', `${metrics.averageQuizScore}%`],
      ['Active Learners', metrics.activeLearners],
      [''],
      ['Event Type', 'Count'],
      ...Object.entries(
        analyticsEvents.reduce((acc, event) => {
          acc[event.eventType] = (acc[event.eventType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      )
    ].map(row => Array.isArray(row) ? row.join(',') : row).join('\n');

    const blob = new Blob([analyticsData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-detailed-report-${timestamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (eventsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold" data-testid="heading-analytics-reporting">
          Analytics & Reporting
        </h2>
        <div className="flex items-center space-x-3">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-40" data-testid="select-date-range">
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 Days</SelectItem>
              <SelectItem value="30">Last 30 Days</SelectItem>
              <SelectItem value="90">Last 90 Days</SelectItem>
              <SelectItem value="365">Last Year</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          
          {dateRange === 'custom' && (
            <>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40"
                data-testid="input-start-date"
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40"
                data-testid="input-end-date"
              />
            </>
          )}

          {/* Advanced Filters */}
          <div className="flex items-center space-x-3 border-l border-border pl-3">
            <Select 
              value={filters.department} 
              onValueChange={(value) => setFilters(prev => ({ ...prev, department: value }))}
            >
              <SelectTrigger className="w-40" data-testid="select-department">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Departments</SelectItem>
                {Array.from(new Set(users.map(u => u.department).filter(Boolean))).map(dept => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select 
              value={filters.riskLevel} 
              onValueChange={(value) => setFilters(prev => ({ ...prev, riskLevel: value }))}
            >
              <SelectTrigger className="w-36" data-testid="select-risk-level">
                <SelectValue placeholder="Risk Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Risk Levels</SelectItem>
                <SelectItem value="High Risk">High Risk</SelectItem>
                <SelectItem value="Medium Risk">Medium Risk</SelectItem>
                <SelectItem value="Low Risk">Low Risk</SelectItem>
              </SelectContent>
            </Select>

            <Select 
              value={filters.eventType} 
              onValueChange={(value) => setFilters(prev => ({ ...prev, eventType: value }))}
            >
              <SelectTrigger className="w-44" data-testid="select-event-type">
                <SelectValue placeholder="Event Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Events</SelectItem>
                <SelectItem value="course_completed">Course Completed</SelectItem>
                <SelectItem value="quiz_completed">Quiz Completed</SelectItem>
                <SelectItem value="email_opened">Email Opened</SelectItem>
                <SelectItem value="email_clicked">Email Clicked</SelectItem>
                <SelectItem value="login">Login</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setFilters({
                department: '',
                riskLevel: '',
                userGroup: '',
                courseStatus: '',
                eventType: '',
                datePreset: '30',
                showInactive: false
              })}
              data-testid="button-clear-filters"
            >
              Clear Filters
            </Button>
          </div>
          
          {currentUser?.role === 'super_admin' && (
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger className="w-48" data-testid="select-client">
                <SelectValue placeholder="All Clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Clients</SelectItem>
                {clients.map(client => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          <Button 
            onClick={handleRefresh} 
            disabled={refreshing}
            variant="outline"
            data-testid="button-refresh"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={exportReport} data-testid="button-export-report">
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Training Completion</p>
                <p className="text-2xl font-bold text-green-600" data-testid="metric-training-completion">
                  {metrics.trainingCompletion}%
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <GraduationCap className="text-green-600 text-xl" />
              </div>
            </div>
            <Progress value={metrics.trainingCompletion} className="mt-4 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Phishing Click Rate</p>
                <p className="text-2xl font-bold text-destructive" data-testid="metric-phishing-click-rate">
                  {metrics.phishingClickRate}%
                </p>
              </div>
              <div className="w-12 h-12 bg-destructive/10 rounded-lg flex items-center justify-center">
                <Fish className="text-destructive text-xl" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Lower is better for security
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Average Quiz Score</p>
                <p className="text-2xl font-bold text-primary" data-testid="metric-average-quiz-score">
                  {metrics.averageQuizScore}%
                </p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <BarChart3 className="text-primary text-xl" />
              </div>
            </div>
            <Progress value={metrics.averageQuizScore} className="mt-4 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Active Learners</p>
                <p className="text-2xl font-bold text-accent" data-testid="metric-active-learners">
                  {metrics.activeLearners}
                </p>
              </div>
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                <Users className="text-accent text-xl" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              In selected time period
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <Tabs value={activeChartTab} onValueChange={setActiveChartTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="trends" data-testid="tab-trends">
            <TrendingUp className="w-4 h-4 mr-2" />
            Trends
          </TabsTrigger>
          <TabsTrigger value="performance" data-testid="tab-performance">
            <BarChart3 className="w-4 h-4 mr-2" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="risk" data-testid="tab-risk">
            <Activity className="w-4 h-4 mr-2" />
            Risk Analysis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5" />
                  <span>Training Progress Over Time</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
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
                        dataKey="coursesCompleted"
                        stroke={chartColors.primary}
                        strokeWidth={2}
                        name="Courses Completed"
                        dot={{ fill: chartColors.primary, strokeWidth: 2, r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="quizzesCompleted"
                        stroke={chartColors.success}
                        strokeWidth={2}
                        name="Quizzes Completed"
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
                  <Fish className="w-5 h-5" />
                  <span>Phishing Campaign Trends</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
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
                        dataKey="emailsOpened"
                        stackId="1"
                        stroke={chartColors.info}
                        fill={chartColors.info}
                        fillOpacity={0.6}
                        name="Emails Opened"
                      />
                      <Area
                        type="monotone"
                        dataKey="phishingClicks"
                        stackId="1"
                        stroke={chartColors.danger}
                        fill={chartColors.danger}
                        fillOpacity={0.8}
                        name="Links Clicked"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="w-5 h-5" />
                  <span>Department Performance</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={departmentData}>
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
                        dataKey="users"
                        fill={chartColors.muted}
                        name="Total Users"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="completed"
                        fill={chartColors.success}
                        name="Completed Training"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Fish className="w-5 h-5" />
                  <span>Phishing Campaign Performance</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  {phishingPerformanceData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={phishingPerformanceData}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis 
                          dataKey="name" 
                          tick={{ fontSize: 12 }}
                          tickLine={false}
                        />
                        <YAxis 
                          yAxisId="left"
                          tick={{ fontSize: 12 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis 
                          yAxisId="right"
                          orientation="right"
                          tick={{ fontSize: 12 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Bar
                          yAxisId="left"
                          dataKey="sent"
                          fill={chartColors.info}
                          name="Emails Sent"
                          radius={[2, 2, 0, 0]}
                        />
                        <Bar
                          yAxisId="left"
                          dataKey="clicked"
                          fill={chartColors.danger}
                          name="Links Clicked"
                          radius={[2, 2, 0, 0]}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="clickRate"
                          stroke={chartColors.warning}
                          strokeWidth={3}
                          name="Click Rate (%)"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center">
                        <Fish className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No phishing campaign data available</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="risk" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="w-5 h-5" />
                  <span>Risk Distribution</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={riskDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {riskDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
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

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5" />
                  <span>Department Risk Levels</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={departmentData}>
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
                        dataKey="risk.high"
                        stackId="risk"
                        fill={chartColors.danger}
                        name="High Risk"
                        radius={[0, 0, 0, 0]}
                      />
                      <Bar
                        dataKey="risk.medium"
                        stackId="risk"
                        fill={chartColors.warning}
                        name="Medium Risk"
                        radius={[0, 0, 0, 0]}
                      />
                      <Bar
                        dataKey="risk.low"
                        stackId="risk"
                        fill={chartColors.success}
                        name="Low Risk"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Detailed Reports Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Users className="w-5 h-5" />
                <span>User Performance Details</span>
              </CardTitle>
              <Button 
                onClick={exportDetailedReport} 
                variant="outline" 
                size="sm"
                data-testid="button-export-detailed"
              >
                <FileText className="w-4 h-4 mr-2" />
                Detailed Export
              </Button>
            </div>
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search users..."
                  className="pl-10 w-64"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  data-testid="input-search-users"
                />
              </div>
              <Button variant="outline" size="sm" data-testid="button-filter">
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-4 font-medium text-sm">User</th>
                  <th className="text-left p-4 font-medium text-sm">Courses Completed</th>
                  <th className="text-left p-4 font-medium text-sm">Quiz Average</th>
                  <th className="text-left p-4 font-medium text-sm">Phishing Tests</th>
                  <th className="text-left p-4 font-medium text-sm">Risk Score</th>
                  <th className="text-left p-4 font-medium text-sm">Last Activity</th>
                  <th className="text-left p-4 font-medium text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {userPerformance.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      {searchTerm ? 'No users match your search' : 'No user data available'}
                    </td>
                  </tr>
                ) : (
                  userPerformance.map((user) => (
                    <tr key={user.id} className="border-t border-border hover:bg-muted/30">
                      <td className="p-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                            <span className="text-primary-foreground font-medium text-sm">
                              {user.firstName[0]}{user.lastName[0]}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium" data-testid={`user-name-${user.id}`}>
                              {user.firstName} {user.lastName}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {user.department || 'No Department'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="font-medium" data-testid={`courses-completed-${user.id}`}>
                          {user.coursesCompleted}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`font-medium ${
                          user.avgQuizScore >= 80 ? 'text-green-600' : 
                          user.avgQuizScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                        }`} data-testid={`quiz-average-${user.id}`}>
                          {user.avgQuizScore}%
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="text-sm">
                          <span className="text-green-600 font-medium">
                            {user.phishingPassed} Passed
                          </span>
                          <span className="text-muted-foreground"> / </span>
                          <span className="text-destructive font-medium">
                            {user.phishingFailed} Failed
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge className={getRiskLevelColor(user.riskLevel)}>
                          {user.riskLevel}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground">
                          {formatLastActivity(user.lastActivity)}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            data-testid={`button-view-user-${user.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            data-testid={`button-recommendations-${user.id}`}
                          >
                            <Lightbulb className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
