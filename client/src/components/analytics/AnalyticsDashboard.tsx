import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  Calendar
} from 'lucide-react';
import { api, type AnalyticsEvent, type User } from '@/lib/api';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

export default function AnalyticsDashboard() {
  const { user: currentUser } = useAuth();
  const [dateRange, setDateRange] = useState('30');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState('');

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

  // Calculate key metrics
  const metrics = {
    trainingCompletion: calculateTrainingCompletion(),
    phishingClickRate: calculatePhishingClickRate(),
    averageQuizScore: calculateAverageQuizScore(),
    activeLearners: calculateActiveLearners()
  };

  function calculateTrainingCompletion() {
    const courseEvents = analyticsEvents.filter(e => e.eventType === 'course_completed');
    const totalUsers = users.length;
    if (totalUsers === 0) return 0;
    
    const uniqueCompletions = new Set(courseEvents.map(e => e.userId)).size;
    return Math.round((uniqueCompletions / totalUsers) * 100);
  }

  function calculatePhishingClickRate() {
    const emailsSent = analyticsEvents.filter(e => e.eventType === 'email_sent').length;
    const emailsClicked = analyticsEvents.filter(e => e.eventType === 'email_clicked').length;
    
    if (emailsSent === 0) return 0;
    return Math.round((emailsClicked / emailsSent) * 100 * 10) / 10;
  }

  function calculateAverageQuizScore() {
    const quizEvents = analyticsEvents.filter(e => 
      e.eventType === 'quiz_completed' && e.metadata?.score
    );
    
    if (quizEvents.length === 0) return 0;
    const totalScore = quizEvents.reduce((sum, e) => sum + (e.metadata.score || 0), 0);
    return Math.round((totalScore / quizEvents.length) * 10) / 10;
  }

  function calculateActiveLearners() {
    const recentEvents = analyticsEvents.filter(e => 
      ['course_started', 'quiz_completed', 'course_completed'].includes(e.eventType)
    );
    return new Set(recentEvents.map(e => e.userId)).size;
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Training Progress Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="chart-container flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Training Progress Chart</p>
                <p className="text-sm">
                  Showing completion rates for the selected period
                </p>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Course Completions:</span>
                    <span className="font-medium">
                      {analyticsEvents.filter(e => e.eventType === 'course_completed').length}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Quiz Completions:</span>
                    <span className="font-medium">
                      {analyticsEvents.filter(e => e.eventType === 'quiz_completed').length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Phishing Campaign Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="chart-container flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Fish className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Campaign Results</p>
                <p className="text-sm">Real-time phishing simulation data</p>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Emails Sent:</span>
                    <span className="font-medium">
                      {analyticsEvents.filter(e => e.eventType === 'email_sent').length}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Emails Opened:</span>
                    <span className="font-medium">
                      {analyticsEvents.filter(e => e.eventType === 'email_opened').length}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Links Clicked:</span>
                    <span className="font-medium text-destructive">
                      {analyticsEvents.filter(e => e.eventType === 'email_clicked').length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Reports Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Users className="w-5 h-5" />
              <span>User Performance Details</span>
            </CardTitle>
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
