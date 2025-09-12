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
  GraduationCap,
  BookOpen,
  Clock,
  Award,
  TrendingUp,
  Users,
  BarChart3,
  Calendar,
  Target,
  CheckCircle,
  XCircle,
  AlertCircle
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
import { api, type AnalyticsEvent, type User, type Course } from '@/lib/api';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

interface TrainingAnalyticsProps {
  dateRange?: string;
  filters?: {
    department?: string;
    courseId?: string;
    difficulty?: string;
  };
}

export default function TrainingAnalytics({ dateRange = '30', filters = {} }: TrainingAnalyticsProps) {
  const { user: currentUser } = useAuth();
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [viewType, setViewType] = useState('overview');

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

  // Filter training-related events
  const trainingEvents = analyticsEvents.filter(e => 
    ['course_started', 'course_completed', 'quiz_completed', 'course_progress'].includes(e.eventType)
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
              {entry.name.includes('Rate') || entry.name.includes('Score') ? '%' : ''}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Calculate training metrics
  const trainingMetrics = {
    totalCourses: courses.length,
    completedCourses: trainingEvents.filter(e => e.eventType === 'course_completed').length,
    averageCompletionTime: calculateAverageCompletionTime(),
    averageQuizScore: calculateAverageQuizScore(),
    activeUsers: new Set(trainingEvents.map(e => e.userId)).size,
    completionRate: calculateCompletionRate()
  };

  function calculateAverageCompletionTime() {
    const completionEvents = trainingEvents.filter(e => e.eventType === 'course_completed');
    if (completionEvents.length === 0) return 0;
    
    const times = completionEvents
      .filter(e => e.metadata?.completionTime)
      .map(e => e.metadata.completionTime);
    
    if (times.length === 0) return 0;
    return Math.round(times.reduce((sum, time) => sum + time, 0) / times.length);
  }

  function calculateAverageQuizScore() {
    const quizEvents = trainingEvents.filter(e => 
      e.eventType === 'quiz_completed' && e.metadata?.score
    );
    
    if (quizEvents.length === 0) return 0;
    const totalScore = quizEvents.reduce((sum, e) => sum + (e.metadata.score || 0), 0);
    return Math.round((totalScore / quizEvents.length) * 10) / 10;
  }

  function calculateCompletionRate() {
    const startedCourses = trainingEvents.filter(e => e.eventType === 'course_started').length;
    const completedCourses = trainingEvents.filter(e => e.eventType === 'course_completed').length;
    
    if (startedCourses === 0) return 0;
    return Math.round((completedCourses / startedCourses) * 100);
  }

  // Course performance data
  const coursePerformanceData = getCoursePerformanceData();

  function getCoursePerformanceData() {
    const courseMap = new Map();
    
    courses.forEach(course => {
      const courseEvents = trainingEvents.filter(e => e.courseId === course.id);
      const started = courseEvents.filter(e => e.eventType === 'course_started').length;
      const completed = courseEvents.filter(e => e.eventType === 'course_completed').length;
      const quizzes = courseEvents.filter(e => e.eventType === 'quiz_completed');
      
      const avgScore = quizzes.length > 0 
        ? Math.round((quizzes.reduce((sum, e) => sum + (e.metadata?.score || 0), 0) / quizzes.length) * 10) / 10
        : 0;
      
      courseMap.set(course.id, {
        name: course.title,
        difficulty: course.difficulty,
        started,
        completed,
        completionRate: started > 0 ? Math.round((completed / started) * 100) : 0,
        averageScore: avgScore,
        estimatedDuration: course.estimatedDuration || 0
      });
    });
    
    return Array.from(courseMap.values());
  }

  // Time series data for training progress
  const trainingProgressData = getTrainingProgressData();

  function getTrainingProgressData() {
    const days = [];
    const startTime = new Date(rangeStart);
    const endTime = new Date(rangeEnd);
    
    for (let d = new Date(startTime); d <= endTime; d.setDate(d.getDate() + 1)) {
      const dayStart = startOfDay(d).getTime();
      const dayEnd = endOfDay(d).getTime();
      
      const dayEvents = trainingEvents.filter(e => {
        const eventTime = new Date(e.timestamp).getTime();
        return eventTime >= dayStart && eventTime <= dayEnd;
      });
      
      days.push({
        date: format(d, 'MMM dd'),
        coursesStarted: dayEvents.filter(e => e.eventType === 'course_started').length,
        coursesCompleted: dayEvents.filter(e => e.eventType === 'course_completed').length,
        quizzesCompleted: dayEvents.filter(e => e.eventType === 'quiz_completed').length
      });
    }
    
    return days;
  }

  // Learning path effectiveness
  const learningPathData = getLearningPathData();

  function getLearningPathData() {
    const difficultyMap = new Map();
    
    courses.forEach(course => {
      const difficulty = course.difficulty || 'beginner';
      if (!difficultyMap.has(difficulty)) {
        difficultyMap.set(difficulty, { name: difficulty, courses: 0, completed: 0, avgScore: 0 });
      }
      
      const courseEvents = trainingEvents.filter(e => e.courseId === course.id);
      const completed = courseEvents.filter(e => e.eventType === 'course_completed').length;
      const quizzes = courseEvents.filter(e => e.eventType === 'quiz_completed');
      const avgScore = quizzes.length > 0 
        ? quizzes.reduce((sum, e) => sum + (e.metadata?.score || 0), 0) / quizzes.length
        : 0;
      
      const data = difficultyMap.get(difficulty);
      data.courses++;
      data.completed += completed;
      data.avgScore = (data.avgScore + avgScore) / 2;
    });
    
    return Array.from(difficultyMap.values());
  }

  // User progress data
  const userProgressData = getUserProgressData();

  function getUserProgressData() {
    return users.map(user => {
      const userEvents = trainingEvents.filter(e => e.userId === user.id);
      const coursesStarted = userEvents.filter(e => e.eventType === 'course_started').length;
      const coursesCompleted = userEvents.filter(e => e.eventType === 'course_completed').length;
      const quizEvents = userEvents.filter(e => e.eventType === 'quiz_completed');
      
      const avgQuizScore = quizEvents.length > 0 
        ? Math.round((quizEvents.reduce((sum, e) => sum + (e.metadata?.score || 0), 0) / quizEvents.length) * 10) / 10
        : 0;
      
      const lastActivity = userEvents.length > 0 
        ? new Date(Math.max(...userEvents.map(e => new Date(e.timestamp).getTime())))
        : null;
      
      return {
        ...user,
        coursesStarted,
        coursesCompleted,
        completionRate: coursesStarted > 0 ? Math.round((coursesCompleted / coursesStarted) * 100) : 0,
        avgQuizScore,
        lastActivity
      };
    }).sort((a, b) => b.completionRate - a.completionRate);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center space-x-2" data-testid="heading-training-analytics">
            <GraduationCap className="w-6 h-6" />
            <span>Training Analytics</span>
          </h2>
          <p className="text-muted-foreground mt-1">
            Comprehensive analysis of training effectiveness and user progress
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Select value={selectedCourse} onValueChange={setSelectedCourse}>
            <SelectTrigger className="w-48" data-testid="select-course">
              <SelectValue placeholder="All Courses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Courses</SelectItem>
              {courses.map(course => (
                <SelectItem key={course.id} value={course.id}>
                  {course.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
            <SelectTrigger className="w-36" data-testid="select-difficulty">
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Levels</SelectItem>
              <SelectItem value="beginner">Beginner</SelectItem>
              <SelectItem value="intermediate">Intermediate</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Training Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Completion Rate</p>
                <p className="text-2xl font-bold text-success" data-testid="metric-completion-rate">
                  {trainingMetrics.completionRate}%
                </p>
              </div>
              <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center">
                <CheckCircle className="text-success text-xl" />
              </div>
            </div>
            <Progress value={trainingMetrics.completionRate} className="mt-4 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Average Quiz Score</p>
                <p className="text-2xl font-bold text-primary" data-testid="metric-quiz-score">
                  {trainingMetrics.averageQuizScore}%
                </p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Award className="text-primary text-xl" />
              </div>
            </div>
            <Progress value={trainingMetrics.averageQuizScore} className="mt-4 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Active Learners</p>
                <p className="text-2xl font-bold text-info" data-testid="metric-active-learners">
                  {trainingMetrics.activeUsers}
                </p>
              </div>
              <div className="w-12 h-12 bg-info/10 rounded-lg flex items-center justify-center">
                <Users className="text-info text-xl" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              In selected period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Avg. Completion Time</p>
                <p className="text-2xl font-bold text-warning" data-testid="metric-completion-time">
                  {trainingMetrics.averageCompletionTime}min
                </p>
              </div>
              <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center">
                <Clock className="text-warning text-xl" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Per course average
            </p>
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
          <TabsTrigger value="courses" data-testid="tab-courses">
            <BookOpen className="w-4 h-4 mr-2" />
            Course Performance
          </TabsTrigger>
          <TabsTrigger value="progress" data-testid="tab-progress">
            <TrendingUp className="w-4 h-4 mr-2" />
            Progress Tracking
          </TabsTrigger>
          <TabsTrigger value="learners" data-testid="tab-learners">
            <Users className="w-4 h-4 mr-2" />
            Learner Analysis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5" />
                  <span>Training Progress Trends</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trainingProgressData}>
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
                        dataKey="coursesStarted"
                        stroke={chartColors.info}
                        strokeWidth={2}
                        name="Courses Started"
                        dot={{ fill: chartColors.info, strokeWidth: 2, r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="coursesCompleted"
                        stroke={chartColors.success}
                        strokeWidth={2}
                        name="Courses Completed"
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
                  <Target className="w-5 h-5" />
                  <span>Learning Path Effectiveness</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={learningPathData}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis 
                        dataKey="name" 
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
                        dataKey="courses"
                        fill={chartColors.primary}
                        name="Total Courses"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="completed"
                        fill={chartColors.success}
                        name="Completed"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="courses" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BookOpen className="w-5 h-5" />
                <span>Course Performance Analysis</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-4 font-medium text-sm">Course</th>
                      <th className="text-left p-4 font-medium text-sm">Difficulty</th>
                      <th className="text-left p-4 font-medium text-sm">Started</th>
                      <th className="text-left p-4 font-medium text-sm">Completed</th>
                      <th className="text-left p-4 font-medium text-sm">Completion Rate</th>
                      <th className="text-left p-4 font-medium text-sm">Avg. Score</th>
                      <th className="text-left p-4 font-medium text-sm">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coursePerformanceData.map((course, index) => (
                      <tr key={index} className="border-t border-border hover:bg-muted/30">
                        <td className="p-4">
                          <div className="font-medium">{course.name}</div>
                        </td>
                        <td className="p-4">
                          <Badge 
                            variant={
                              course.difficulty === 'advanced' ? 'destructive' : 
                              course.difficulty === 'intermediate' ? 'default' : 'secondary'
                            }
                          >
                            {course.difficulty}
                          </Badge>
                        </td>
                        <td className="p-4 font-medium">{course.started}</td>
                        <td className="p-4 font-medium text-success">{course.completed}</td>
                        <td className="p-4">
                          <div className="flex items-center space-x-2">
                            <Progress value={course.completionRate} className="w-16 h-2" />
                            <span className="text-sm font-medium">{course.completionRate}%</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`font-medium ${
                            course.averageScore >= 80 ? 'text-success' : 
                            course.averageScore >= 60 ? 'text-warning' : 'text-destructive'
                          }`}>
                            {course.averageScore}%
                          </span>
                        </td>
                        <td className="p-4 text-muted-foreground">
                          {course.estimatedDuration}min
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="progress" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5" />
                  <span>Daily Training Activity</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trainingProgressData}>
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
                        dataKey="quizzesCompleted"
                        stackId="1"
                        stroke={chartColors.purple}
                        fill={chartColors.purple}
                        fillOpacity={0.6}
                        name="Quizzes Completed"
                      />
                      <Area
                        type="monotone"
                        dataKey="coursesCompleted"
                        stackId="1"
                        stroke={chartColors.success}
                        fill={chartColors.success}
                        fillOpacity={0.8}
                        name="Courses Completed"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Award className="w-5 h-5" />
                  <span>Score Distribution</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: '90-100%', value: trainingEvents.filter(e => e.eventType === 'quiz_completed' && (e.metadata?.score || 0) >= 90).length, color: chartColors.success },
                          { name: '80-89%', value: trainingEvents.filter(e => e.eventType === 'quiz_completed' && (e.metadata?.score || 0) >= 80 && (e.metadata?.score || 0) < 90).length, color: chartColors.primary },
                          { name: '70-79%', value: trainingEvents.filter(e => e.eventType === 'quiz_completed' && (e.metadata?.score || 0) >= 70 && (e.metadata?.score || 0) < 80).length, color: chartColors.warning },
                          { name: '<70%', value: trainingEvents.filter(e => e.eventType === 'quiz_completed' && (e.metadata?.score || 0) < 70).length, color: chartColors.danger }
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {[chartColors.success, chartColors.primary, chartColors.warning, chartColors.danger].map((color, index) => (
                          <Cell key={`cell-${index}`} fill={color} />
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

        <TabsContent value="learners" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="w-5 h-5" />
                <span>Top Performing Learners</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-4 font-medium text-sm">Learner</th>
                      <th className="text-left p-4 font-medium text-sm">Department</th>
                      <th className="text-left p-4 font-medium text-sm">Courses Started</th>
                      <th className="text-left p-4 font-medium text-sm">Completed</th>
                      <th className="text-left p-4 font-medium text-sm">Completion Rate</th>
                      <th className="text-left p-4 font-medium text-sm">Avg. Score</th>
                      <th className="text-left p-4 font-medium text-sm">Last Activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userProgressData.slice(0, 10).map((user) => (
                      <tr key={user.id} className="border-t border-border hover:bg-muted/30">
                        <td className="p-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                              <span className="text-primary-foreground font-medium text-sm">
                                {user.firstName[0]}{user.lastName[0]}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium">{user.firstName} {user.lastName}</p>
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge variant="outline">
                            {user.department || 'No Department'}
                          </Badge>
                        </td>
                        <td className="p-4 font-medium">{user.coursesStarted}</td>
                        <td className="p-4 font-medium text-success">{user.coursesCompleted}</td>
                        <td className="p-4">
                          <div className="flex items-center space-x-2">
                            <Progress value={user.completionRate} className="w-16 h-2" />
                            <span className="text-sm font-medium">{user.completionRate}%</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`font-medium ${
                            user.avgQuizScore >= 80 ? 'text-success' : 
                            user.avgQuizScore >= 60 ? 'text-warning' : 'text-destructive'
                          }`}>
                            {user.avgQuizScore}%
                          </span>
                        </td>
                        <td className="p-4 text-muted-foreground text-sm">
                          {user.lastActivity ? format(user.lastActivity, 'MMM dd, yyyy') : 'Never'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}