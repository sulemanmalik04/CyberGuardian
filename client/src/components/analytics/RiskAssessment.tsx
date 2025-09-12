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
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Activity,
  Users,
  Award,
  Calendar,
  Target,
  BarChart3,
  PieChart,
  Gauge,
  FileShield,
  Lock
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  RadialBarChart,
  RadialBar
} from 'recharts';
import { api, type AnalyticsEvent, type User } from '@/lib/api';
import { format, subDays, startOfDay, endOfDay, subMonths } from 'date-fns';

interface RiskAssessmentProps {
  dateRange?: string;
  filters?: {
    department?: string;
    riskLevel?: string;
    complianceStatus?: string;
  };
}

export default function RiskAssessment({ dateRange = '30', filters = {} }: RiskAssessmentProps) {
  const { user: currentUser } = useAuth();
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedRiskLevel, setSelectedRiskLevel] = useState('');
  const [viewType, setViewType] = useState('overview');
  const [comparisonPeriod, setComparisonPeriod] = useState('previous');

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

  const { data: courses = [] } = useQuery({
    queryKey: ['courses'],
    queryFn: () => api.getCourses(),
    enabled: !!currentUser
  });

  // Chart colors
  const chartColors = {
    primary: '#3b82f6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#06b6d4',
    purple: '#8b5cf6',
    orange: '#f97316',
    green: '#22c55e',
    red: '#dc2626'
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
              {entry.name.includes('Score') || entry.name.includes('Rate') ? '%' : ''}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Calculate overall risk metrics
  const riskMetrics = {
    overallRiskScore: calculateOverallRiskScore(),
    complianceRate: calculateComplianceRate(),
    securityPosture: calculateSecurityPosture(),
    vulnerabilityTrend: calculateVulnerabilityTrend(),
    incidentCount: calculateIncidentCount(),
    improvementRate: calculateImprovementRate()
  };

  function calculateOverallRiskScore() {
    // Calculate based on multiple factors
    const trainingEvents = analyticsEvents.filter(e => 
      ['course_completed', 'quiz_completed'].includes(e.eventType)
    );
    const phishingEvents = analyticsEvents.filter(e => 
      ['email_clicked', 'phishing_reported'].includes(e.eventType)
    );
    
    // Training completion factor (0-40 points)
    const trainingCompletionRate = users.length > 0 ? 
      (new Set(trainingEvents.map(e => e.userId)).size / users.length) * 40 : 0;
    
    // Phishing awareness factor (0-30 points)
    const phishingClicks = phishingEvents.filter(e => e.eventType === 'email_clicked').length;
    const phishingReports = phishingEvents.filter(e => e.eventType === 'phishing_reported').length;
    const phishingScore = phishingClicks > 0 ? 
      Math.max(0, 30 - (phishingClicks / Math.max(1, phishingEvents.length)) * 30) : 30;
    
    // Quiz performance factor (0-30 points)
    const quizEvents = trainingEvents.filter(e => 
      e.eventType === 'quiz_completed' && e.metadata?.score
    );
    const avgQuizScore = quizEvents.length > 0 ? 
      (quizEvents.reduce((sum, e) => sum + (e.metadata?.score || 0), 0) / quizEvents.length) : 80;
    const quizFactor = (avgQuizScore / 100) * 30;
    
    const totalScore = trainingCompletionRate + phishingScore + quizFactor;
    return Math.round(Math.min(100, Math.max(0, totalScore)));
  }

  function calculateComplianceRate() {
    const totalUsers = users.length;
    if (totalUsers === 0) return 100;
    
    const compliantUsers = users.filter(user => {
      const userEvents = analyticsEvents.filter(e => e.userId === user.id);
      const hasCompletedTraining = userEvents.some(e => e.eventType === 'course_completed');
      const recentActivity = userEvents.some(e => 
        new Date(e.timestamp) > subDays(new Date(), 90)
      );
      return hasCompletedTraining && recentActivity;
    }).length;
    
    return Math.round((compliantUsers / totalUsers) * 100);
  }

  function calculateSecurityPosture() {
    const riskScore = riskMetrics.overallRiskScore;
    if (riskScore >= 80) return 'Excellent';
    if (riskScore >= 60) return 'Good';
    if (riskScore >= 40) return 'Fair';
    if (riskScore >= 20) return 'Poor';
    return 'Critical';
  }

  function calculateVulnerabilityTrend() {
    // Compare current period with previous period
    const currentPeriodStart = new Date(rangeStart);
    const previousPeriodEnd = currentPeriodStart;
    const previousPeriodStart = subDays(previousPeriodEnd, 
      Math.ceil((new Date(rangeEnd).getTime() - currentPeriodStart.getTime()) / (1000 * 60 * 60 * 24))
    );
    
    const currentClicks = analyticsEvents.filter(e => 
      e.eventType === 'email_clicked' && 
      new Date(e.timestamp) >= currentPeriodStart
    ).length;
    
    const previousClicks = analyticsEvents.filter(e => 
      e.eventType === 'email_clicked' && 
      new Date(e.timestamp) >= previousPeriodStart && 
      new Date(e.timestamp) < previousPeriodEnd
    ).length;
    
    if (previousClicks === 0) return currentClicks === 0 ? 0 : 100;
    const change = ((currentClicks - previousClicks) / previousClicks) * 100;
    return Math.round(change * 10) / 10;
  }

  function calculateIncidentCount() {
    return analyticsEvents.filter(e => 
      ['email_clicked', 'security_incident', 'policy_violation'].includes(e.eventType)
    ).length;
  }

  function calculateImprovementRate() {
    const currentPeriodUsers = new Set(analyticsEvents
      .filter(e => e.eventType === 'course_completed')
      .map(e => e.userId)
    ).size;
    
    const totalUsers = users.length;
    return totalUsers > 0 ? Math.round((currentPeriodUsers / totalUsers) * 100) : 0;
  }

  // Risk distribution by department
  const departmentRiskData = getDepartmentRiskData();

  function getDepartmentRiskData() {
    const deptMap = new Map();
    
    users.forEach(user => {
      const dept = user.department || 'No Department';
      if (!deptMap.has(dept)) {
        deptMap.set(dept, { 
          name: dept, 
          users: 0, 
          highRisk: 0, 
          mediumRisk: 0, 
          lowRisk: 0,
          totalRiskScore: 0
        });
      }
      
      const userEvents = analyticsEvents.filter(e => e.userId === user.id);
      const phishingClicks = userEvents.filter(e => e.eventType === 'email_clicked').length;
      const coursesCompleted = userEvents.filter(e => e.eventType === 'course_completed').length;
      const quizEvents = userEvents.filter(e => e.eventType === 'quiz_completed');
      
      const avgQuizScore = quizEvents.length > 0 ? 
        quizEvents.reduce((sum, e) => sum + (e.metadata?.score || 0), 0) / quizEvents.length : 0;
      
      let riskLevel = 'Low Risk';
      if (phishingClicks > 2 || avgQuizScore < 60) riskLevel = 'High Risk';
      else if (phishingClicks > 0 || avgQuizScore < 80) riskLevel = 'Medium Risk';
      
      // Calculate individual risk score
      const userRiskScore = Math.max(0, 100 - (coursesCompleted * 20) - (avgQuizScore * 0.5) + (phishingClicks * 15));
      
      const deptData = deptMap.get(dept);
      deptData.users++;
      deptData.totalRiskScore += userRiskScore;
      
      if (riskLevel === 'High Risk') deptData.highRisk++;
      else if (riskLevel === 'Medium Risk') deptData.mediumRisk++;
      else deptData.lowRisk++;
    });
    
    return Array.from(deptMap.values()).map(dept => ({
      ...dept,
      avgRiskScore: dept.users > 0 ? Math.round(dept.totalRiskScore / dept.users) : 0,
      riskDistribution: dept.users > 0 ? {
        high: Math.round((dept.highRisk / dept.users) * 100),
        medium: Math.round((dept.mediumRisk / dept.users) * 100),
        low: Math.round((dept.lowRisk / dept.users) * 100)
      } : { high: 0, medium: 0, low: 0 }
    })).sort((a, b) => b.avgRiskScore - a.avgRiskScore);
  }

  // Risk trend over time
  const riskTrendData = getRiskTrendData();

  function getRiskTrendData() {
    const days = [];
    const startTime = new Date(rangeStart);
    const endTime = new Date(rangeEnd);
    
    for (let d = new Date(startTime); d <= endTime; d.setDate(d.getDate() + 1)) {
      const dayStart = startOfDay(d).getTime();
      const dayEnd = endOfDay(d).getTime();
      
      const dayEvents = analyticsEvents.filter(e => {
        const eventTime = new Date(e.timestamp).getTime();
        return eventTime >= dayStart && eventTime <= dayEnd;
      });
      
      const phishingClicks = dayEvents.filter(e => e.eventType === 'email_clicked').length;
      const coursesCompleted = dayEvents.filter(e => e.eventType === 'course_completed').length;
      const incidentCount = dayEvents.filter(e => 
        ['email_clicked', 'security_incident', 'policy_violation'].includes(e.eventType)
      ).length;
      
      // Calculate daily risk score
      const dailyRiskScore = Math.max(0, 100 - (coursesCompleted * 10) + (phishingClicks * 5) + (incidentCount * 3));
      
      days.push({
        date: format(d, 'MMM dd'),
        riskScore: Math.min(100, dailyRiskScore),
        incidents: incidentCount,
        phishingClicks,
        coursesCompleted,
        complianceRate: Math.max(0, 100 - dailyRiskScore)
      });
    }
    
    return days;
  }

  // Compliance tracking data
  const complianceData = getComplianceData();

  function getComplianceData() {
    return users.map(user => {
      const userEvents = analyticsEvents.filter(e => e.userId === user.id);
      const coursesCompleted = userEvents.filter(e => e.eventType === 'course_completed').length;
      const lastTraining = userEvents
        .filter(e => e.eventType === 'course_completed')
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
      
      const daysSinceLastTraining = lastTraining ? 
        Math.floor((new Date().getTime() - new Date(lastTraining.timestamp).getTime()) / (1000 * 60 * 60 * 24)) : 
        999;
      
      const isCompliant = coursesCompleted > 0 && daysSinceLastTraining <= 365;
      const needsRenewal = daysSinceLastTraining > 300 && daysSinceLastTraining <= 365;
      const isOverdue = daysSinceLastTraining > 365;
      
      return {
        ...user,
        coursesCompleted,
        lastTraining: lastTraining ? new Date(lastTraining.timestamp) : null,
        daysSinceLastTraining,
        isCompliant,
        needsRenewal,
        isOverdue,
        complianceStatus: isOverdue ? 'Overdue' : needsRenewal ? 'Renewal Required' : isCompliant ? 'Compliant' : 'Not Started'
      };
    }).sort((a, b) => a.daysSinceLastTraining - b.daysSinceLastTraining);
  }

  // Security incidents data
  const securityIncidentsData = getSecurityIncidentsData();

  function getSecurityIncidentsData() {
    const incidentTypes = ['email_clicked', 'policy_violation', 'security_incident', 'unauthorized_access'];
    const incidentMap = new Map();
    
    incidentTypes.forEach(type => {
      incidentMap.set(type, {
        type: type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        count: analyticsEvents.filter(e => e.eventType === type).length,
        severity: type === 'email_clicked' ? 'Medium' : 
                 type === 'policy_violation' ? 'Low' : 'High'
      });
    });
    
    return Array.from(incidentMap.values()).sort((a, b) => b.count - a.count);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center space-x-2" data-testid="heading-risk-assessment">
            <Shield className="w-6 h-6" />
            <span>Risk Assessment & Compliance</span>
          </h2>
          <p className="text-muted-foreground mt-1">
            Security posture monitoring and compliance tracking
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
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
          
          <Select value={selectedRiskLevel} onValueChange={setSelectedRiskLevel}>
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
        </div>
      </div>

      {/* Risk Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Overall Risk Score</p>
                <p className="text-2xl font-bold" data-testid="metric-risk-score">
                  {riskMetrics.overallRiskScore}/100
                </p>
                <p className={`text-sm font-medium ${
                  riskMetrics.overallRiskScore >= 80 ? 'text-success' :
                  riskMetrics.overallRiskScore >= 60 ? 'text-warning' : 'text-danger'
                }`}>
                  {riskMetrics.securityPosture}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{
                backgroundColor: riskMetrics.overallRiskScore >= 80 ? chartColors.success + '20' :
                                riskMetrics.overallRiskScore >= 60 ? chartColors.warning + '20' : 
                                chartColors.danger + '20'
              }}>
                <Gauge className="text-xl" style={{
                  color: riskMetrics.overallRiskScore >= 80 ? chartColors.success :
                         riskMetrics.overallRiskScore >= 60 ? chartColors.warning : 
                         chartColors.danger
                }} />
              </div>
            </div>
            <Progress 
              value={riskMetrics.overallRiskScore} 
              className="mt-4 h-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Compliance Rate</p>
                <p className="text-2xl font-bold text-success" data-testid="metric-compliance-rate">
                  {riskMetrics.complianceRate}%
                </p>
                <div className="flex items-center space-x-1 mt-1">
                  {riskMetrics.improvementRate > 0 ? (
                    <TrendingUp className="w-4 h-4 text-success" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-danger" />
                  )}
                  <span className="text-sm text-muted-foreground">
                    {Math.abs(riskMetrics.improvementRate)}% this period
                  </span>
                </div>
              </div>
              <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center">
                <FileShield className="text-success text-xl" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Security Incidents</p>
                <p className="text-2xl font-bold text-danger" data-testid="metric-incidents">
                  {riskMetrics.incidentCount}
                </p>
                <div className="flex items-center space-x-1 mt-1">
                  {riskMetrics.vulnerabilityTrend <= 0 ? (
                    <TrendingDown className="w-4 h-4 text-success" />
                  ) : (
                    <TrendingUp className="w-4 h-4 text-danger" />
                  )}
                  <span className="text-sm text-muted-foreground">
                    {Math.abs(riskMetrics.vulnerabilityTrend)}% vs last period
                  </span>
                </div>
              </div>
              <div className="w-12 h-12 bg-danger/10 rounded-lg flex items-center justify-center">
                <AlertTriangle className="text-danger text-xl" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Users at Risk</p>
                <p className="text-2xl font-bold text-warning" data-testid="metric-users-at-risk">
                  {departmentRiskData.reduce((sum, dept) => sum + dept.highRisk + dept.mediumRisk, 0)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Need immediate attention
                </p>
              </div>
              <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center">
                <Users className="text-warning text-xl" />
              </div>
            </div>
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
          <TabsTrigger value="risk-trends" data-testid="tab-risk-trends">
            <TrendingUp className="w-4 h-4 mr-2" />
            Risk Trends
          </TabsTrigger>
          <TabsTrigger value="compliance" data-testid="tab-compliance">
            <Award className="w-4 h-4 mr-2" />
            Compliance
          </TabsTrigger>
          <TabsTrigger value="incidents" data-testid="tab-incidents">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Incidents
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="w-5 h-5" />
                  <span>Risk Score by Department</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={departmentRiskData.slice(0, 8)}>
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
                        dataKey="avgRiskScore"
                        fill={chartColors.warning}
                        name="Avg Risk Score"
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
                  <PieChart className="w-5 h-5" />
                  <span>Risk Distribution</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={[
                          { 
                            name: 'High Risk', 
                            value: departmentRiskData.reduce((sum, dept) => sum + dept.highRisk, 0), 
                            color: chartColors.danger 
                          },
                          { 
                            name: 'Medium Risk', 
                            value: departmentRiskData.reduce((sum, dept) => sum + dept.mediumRisk, 0), 
                            color: chartColors.warning 
                          },
                          { 
                            name: 'Low Risk', 
                            value: departmentRiskData.reduce((sum, dept) => sum + dept.lowRisk, 0), 
                            color: chartColors.success 
                          }
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {[chartColors.danger, chartColors.warning, chartColors.success].map((color, index) => (
                          <Cell key={`cell-${index}`} fill={color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value, name) => [value, name]}
                        labelFormatter={() => ''}
                      />
                      <Legend />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="risk-trends" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5" />
                  <span>Risk Score Trends</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={riskTrendData}>
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
                        dataKey="riskScore"
                        stroke={chartColors.danger}
                        strokeWidth={3}
                        name="Risk Score"
                        dot={{ fill: chartColors.danger, strokeWidth: 2, r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="complianceRate"
                        stroke={chartColors.success}
                        strokeWidth={3}
                        name="Compliance Rate"
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
                  <span>Security Incidents Timeline</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={riskTrendData}>
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
                        dataKey="incidents"
                        stackId="1"
                        stroke={chartColors.danger}
                        fill={chartColors.danger}
                        fillOpacity={0.6}
                        name="Security Incidents"
                      />
                      <Area
                        type="monotone"
                        dataKey="phishingClicks"
                        stackId="1"
                        stroke={chartColors.warning}
                        fill={chartColors.warning}
                        fillOpacity={0.4}
                        name="Phishing Clicks"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Award className="w-5 h-5" />
                <span>Compliance Tracking</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-4 font-medium text-sm">User</th>
                      <th className="text-left p-4 font-medium text-sm">Department</th>
                      <th className="text-left p-4 font-medium text-sm">Courses Completed</th>
                      <th className="text-left p-4 font-medium text-sm">Last Training</th>
                      <th className="text-left p-4 font-medium text-sm">Days Since</th>
                      <th className="text-left p-4 font-medium text-sm">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {complianceData.slice(0, 20).map((user) => (
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
                              <p className="text-xs text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge variant="outline" className="text-xs">
                            {user.department || 'No Dept'}
                          </Badge>
                        </td>
                        <td className="p-4 font-medium">{user.coursesCompleted}</td>
                        <td className="p-4 text-sm">
                          {user.lastTraining ? format(user.lastTraining, 'MMM dd, yyyy') : 'Never'}
                        </td>
                        <td className="p-4 text-sm">
                          {user.daysSinceLastTraining < 999 ? user.daysSinceLastTraining : 'N/A'}
                        </td>
                        <td className="p-4">
                          <Badge 
                            className={
                              user.complianceStatus === 'Compliant' ? 'bg-green-100 text-green-800' :
                              user.complianceStatus === 'Renewal Required' ? 'bg-yellow-100 text-yellow-800' :
                              user.complianceStatus === 'Overdue' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }
                          >
                            {user.complianceStatus}
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

        <TabsContent value="incidents" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5" />
                  <span>Incident Types</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {securityIncidentsData.map((incident, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${
                          incident.severity === 'High' ? 'bg-red-500' :
                          incident.severity === 'Medium' ? 'bg-yellow-500' : 'bg-green-500'
                        }`} />
                        <div>
                          <p className="font-medium text-sm">{incident.type}</p>
                          <p className="text-xs text-muted-foreground">Severity: {incident.severity}</p>
                        </div>
                      </div>
                      <Badge variant="outline">
                        {incident.count} incidents
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Target className="w-5 h-5" />
                  <span>Risk Mitigation Progress</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Training Completion</span>
                      <span className="text-sm text-muted-foreground">{riskMetrics.complianceRate}%</span>
                    </div>
                    <Progress value={riskMetrics.complianceRate} className="h-2" />
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Security Awareness</span>
                      <span className="text-sm text-muted-foreground">{100 - (riskMetrics.incidentCount * 2)}%</span>
                    </div>
                    <Progress value={Math.max(0, 100 - (riskMetrics.incidentCount * 2))} className="h-2" />
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Policy Compliance</span>
                      <span className="text-sm text-muted-foreground">{riskMetrics.overallRiskScore}%</span>
                    </div>
                    <Progress value={riskMetrics.overallRiskScore} className="h-2" />
                  </div>
                  
                  <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <Lock className="w-4 h-4 text-primary" />
                      <span className="font-medium text-sm">Security Posture</span>
                    </div>
                    <p className="text-2xl font-bold" style={{
                      color: riskMetrics.overallRiskScore >= 80 ? chartColors.success :
                             riskMetrics.overallRiskScore >= 60 ? chartColors.warning : 
                             chartColors.danger
                    }}>
                      {riskMetrics.securityPosture}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Based on overall risk assessment
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}