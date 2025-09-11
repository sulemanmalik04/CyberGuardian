import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  BookOpen, 
  Award, 
  Clock, 
  TrendingUp,
  Play,
  CheckCircle
} from 'lucide-react';
import { api, type Course, type UserProgress } from '@/lib/api';

export default function UserDashboard() {
  const { user } = useAuth();

  const { data: courses = [], isLoading: coursesLoading } = useQuery({
    queryKey: ['courses', 'published'],
    queryFn: api.getPublishedCourses
  });

  const { data: userProgress = [], isLoading: progressLoading } = useQuery({
    queryKey: ['progress', user?.id],
    queryFn: () => user ? api.getUserProgress(user.id) : [],
    enabled: !!user
  });

  // Calculate overall progress
  const completedCourses = userProgress.filter(p => p.isCompleted).length;
  const totalCourses = courses.length;
  const overallProgress = totalCourses > 0 ? (completedCourses / totalCourses) * 100 : 0;

  // Get current course (most recently accessed)
  const currentCourse = userProgress
    .filter(p => !p.isCompleted)
    .sort((a, b) => new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime())[0];

  const getCourseById = (courseId: string) => 
    courses.find(c => c.id === courseId);

  const formatDuration = (minutes?: number) => {
    if (!minutes) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  if (coursesLoading || progressLoading) {
    return (
      <div className="p-6 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
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
    <div className="p-6 space-y-8">
      {/* Welcome Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold" data-testid="heading-welcome">
          Welcome back, {user?.firstName}!
        </h1>
        <p className="text-muted-foreground">
          Continue your cybersecurity training journey
        </p>
      </div>

      {/* Progress Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Courses Completed</p>
                <p className="text-2xl font-bold" data-testid="stat-completed-courses">
                  {completedCourses}/{totalCourses}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="text-green-600 text-xl" />
              </div>
            </div>
            <div className="mt-4">
              <Progress value={overallProgress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {Math.round(overallProgress)}% complete
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Time Invested</p>
                <p className="text-2xl font-bold" data-testid="stat-time-invested">
                  24h 30m
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Clock className="text-blue-600 text-xl" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              This month: +5h 15m
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Certificates</p>
                <p className="text-2xl font-bold" data-testid="stat-certificates">
                  {completedCourses}
                </p>
              </div>
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                <Award className="text-amber-600 text-xl" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Latest: Email Security
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Continue Learning Section */}
      {currentCourse && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5" />
              <span>Continue Learning</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const course = getCourseById(currentCourse.courseId);
              if (!course) return null;
              
              return (
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center">
                      <BookOpen className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold" data-testid="current-course-title">
                        {course.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Module {currentCourse.currentModule + 1} of {course.content.modules.length}
                      </p>
                      <div className="flex items-center space-x-4 mt-2">
                        <Progress value={currentCourse.progress} className="w-32 h-2" />
                        <span className="text-sm text-muted-foreground">
                          {currentCourse.progress}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button data-testid="button-continue-course">
                    <Play className="w-4 h-4 mr-2" />
                    Continue
                  </Button>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Available Courses */}
      <Card>
        <CardHeader>
          <CardTitle>Available Courses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course: Course) => {
              const progress = userProgress.find(p => p.courseId === course.id);
              const isCompleted = progress?.isCompleted || false;
              const progressPercent = progress?.progress || 0;

              return (
                <Card key={course.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <Badge variant="secondary">
                          {course.difficulty}
                        </Badge>
                        {isCompleted && (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        )}
                      </div>
                      
                      <div>
                        <h3 className="font-semibold text-lg mb-2" data-testid={`course-title-${course.id}`}>
                          {course.title}
                        </h3>
                        <p className="text-muted-foreground text-sm line-clamp-3">
                          {course.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>{formatDuration(course.estimatedDuration)}</span>
                        <span>{course.content.modules.length} modules</span>
                        <span>{course.language}</span>
                      </div>

                      {progress && !isCompleted && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span>Progress</span>
                            <span className="font-medium">{progressPercent}%</span>
                          </div>
                          <Progress value={progressPercent} className="h-2" />
                        </div>
                      )}

                      <Button 
                        className="w-full" 
                        variant={isCompleted ? "outline" : "default"}
                        data-testid={`button-course-${course.id}`}
                      >
                        {isCompleted ? (
                          <>
                            <Award className="w-4 h-4 mr-2" />
                            View Certificate
                          </>
                        ) : progress ? (
                          <>
                            <Play className="w-4 h-4 mr-2" />
                            Continue Learning
                          </>
                        ) : (
                          <>
                            <BookOpen className="w-4 h-4 mr-2" />
                            Start Course
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {courses.length === 0 && (
            <div className="text-center p-8 text-muted-foreground">
              <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No courses available at the moment.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
