import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { 
  Play, 
  BookOpen, 
  Plus, 
  Wand2, 
  CheckCircle,
  Clock,
  Users,
  Globe,
  X,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  StickyNote,
  Share,
  Trophy,
  GraduationCap,
  Loader2,
  Award
} from 'lucide-react';
import { api, type Course, type UserProgress } from '@/lib/api';
import QuizComponent from './QuizComponent';

export default function CourseDelivery() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [currentModule, setCurrentModule] = useState(0);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generateFormData, setGenerateFormData] = useState({
    topic: '',
    difficulty: 'beginner',
    modules: 5
  });

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['courses', 'published'],
    queryFn: api.getPublishedCourses
  });

  const { data: userProgress = [] } = useQuery({
    queryKey: ['progress', currentUser?.id],
    queryFn: () => currentUser ? api.getUserProgress(currentUser.id) : [],
    enabled: !!currentUser && currentUser.role === 'end_user'
  });

  const updateProgressMutation = useMutation({
    mutationFn: ({ userId, courseId, updates }: {
      userId: string;
      courseId: string;
      updates: Partial<UserProgress>;
    }) => api.updateUserProgress(userId, courseId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['progress'] });
    }
  });

  const generateCourseMutation = useMutation({
    mutationFn: ({ topic, difficulty, modules }: {
      topic: string;
      difficulty: string;
      modules: number;
    }) => api.generateCourse(topic, difficulty, modules),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      setShowGenerateDialog(false);
      toast({
        title: 'Course Generated',
        description: 'Your AI-generated course has been created successfully!'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Generation Failed',
        description: error.message || 'Failed to generate course. Please try again.',
        variant: 'destructive'
      });
    }
  });

  const getCourseProgress = (courseId: string) => {
    return userProgress.find(p => p.courseId === courseId);
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'beginner':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'advanced':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const handleStartCourse = (course: Course) => {
    setSelectedCourse(course);
    setCurrentModule(0);
    
    if (currentUser && currentUser.role === 'end_user') {
      const existingProgress = getCourseProgress(course.id);
      if (!existingProgress) {
        updateProgressMutation.mutate({
          userId: currentUser.id,
          courseId: course.id,
          updates: {
            progress: 0,
            currentModule: 0,
            completedModules: [],
            isCompleted: false
          }
        });
      }
    }
  };

  const handleModuleComplete = () => {
    if (!selectedCourse || !currentUser || currentUser.role !== 'end_user') return;

    const currentModuleData = selectedCourse.content.modules[currentModule];
    
    // If module has quiz, show it instead of completing directly
    if (currentModuleData.quiz && currentModuleData.quiz.questions.length > 0) {
      setShowQuiz(true);
      return;
    }

    // No quiz, complete the module directly
    completeModule();
  };

  const completeModule = (quizScore?: number) => {
    if (!selectedCourse || !currentUser || currentUser.role !== 'end_user') return;

    const progress = getCourseProgress(selectedCourse.id);
    const totalModules = selectedCourse.content.modules.length;
    const completedModules = [...(progress?.completedModules || []), currentModule.toString()];
    const newProgress = Math.round((completedModules.length / totalModules) * 100);
    const isCompleted = completedModules.length === totalModules;

    // Update quiz scores if provided
    const quizScores = progress?.quizScores || {};
    if (quizScore !== undefined) {
      quizScores[`module-${currentModule}`] = quizScore;
    }

    updateProgressMutation.mutate({
      userId: currentUser.id,
      courseId: selectedCourse.id,
      updates: {
        progress: newProgress,
        currentModule: Math.min(currentModule + 1, totalModules - 1),
        completedModules,
        quizScores,
        isCompleted,
        ...(isCompleted && { completedAt: new Date().toISOString() })
      }
    });

    if (currentModule < totalModules - 1) {
      setCurrentModule(currentModule + 1);
    }
  };

  const handleQuizComplete = (score: number, answers: any[], timeTaken: number) => {
    completeModule(score);
    setShowQuiz(false);
    
    toast({
      title: score >= 70 ? 'Quiz Passed!' : 'Quiz Complete',
      description: score >= 70 
        ? `Congratulations! You scored ${score}%` 
        : `You scored ${score}%. Consider reviewing the material.`,
      variant: score >= 70 ? 'default' : 'destructive'
    });
  };

  const handleGenerateCourse = () => {
    if (!generateFormData.topic.trim()) {
      toast({
        title: 'Topic Required',
        description: 'Please enter a topic for the course',
        variant: 'destructive'
      });
      return;
    }

    generateCourseMutation.mutate(generateFormData);
  };

  const getOverallGrade = (progress: UserProgress) => {
    if (!progress.quizScores || Object.keys(progress.quizScores).length === 0) {
      return 'N/A';
    }
    
    const scores = Object.values(progress.quizScores as Record<string, number>);
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    if (average >= 90) return 'A';
    if (average >= 80) return 'B';
    if (average >= 70) return 'C';
    if (average >= 60) return 'D';
    return 'F';
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-32 bg-gray-200 rounded mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Show quiz if active
  if (showQuiz && selectedCourse) {
    const currentModuleData = selectedCourse.content.modules[currentModule];
    if (currentModuleData.quiz) {
      return (
        <QuizComponent
          moduleTitle={currentModuleData.title}
          questions={currentModuleData.quiz.questions}
          onQuizComplete={handleQuizComplete}
          onQuizCancel={() => setShowQuiz(false)}
          passingScore={70}
        />
      );
    }
  }

  return (
    <div className="space-y-6">
      {!selectedCourse ? (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold" data-testid="heading-training-courses">
              Training Courses
            </h2>
            {(currentUser?.role === 'super_admin' || currentUser?.role === 'client_admin') && (
              <div className="flex items-center space-x-3">
                <Button 
                  variant="outline"
                  onClick={() => setShowGenerateDialog(true)}
                  data-testid="button-ai-generate-course"
                >
                  <Wand2 className="w-4 h-4 mr-2" />
                  AI Generate Course
                </Button>
                <Button data-testid="button-create-course">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Course
                </Button>
              </div>
            )}
          </div>

          {/* Course Library */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course: Course) => {
              const progress = getCourseProgress(course.id);
              const isCompleted = progress?.isCompleted || false;
              const progressPercent = progress?.progress || 0;
              const grade = progress ? getOverallGrade(progress) : 'N/A';

              return (
                <Card key={course.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-0">
                    <div className="relative">
                      {/* Course thumbnail */}
                      <div className="h-48 bg-gradient-to-br from-primary/10 to-accent/10 relative overflow-hidden rounded-t-lg">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Button
                            size="lg"
                            className="w-16 h-16 rounded-full"
                            onClick={() => handleStartCourse(course)}
                            data-testid={`button-play-course-${course.id}`}
                          >
                            <Play className="w-6 h-6 ml-1" />
                          </Button>
                        </div>
                        <div className="absolute top-4 right-4">
                          <Badge className={getDifficultyColor(course.difficulty)}>
                            {course.difficulty}
                          </Badge>
                        </div>
                        {isCompleted && (
                          <div className="absolute top-4 left-4 flex items-center space-x-2">
                            <CheckCircle className="w-6 h-6 text-green-600" />
                            {grade !== 'N/A' && (
                              <Badge className="bg-green-600 text-white">
                                Grade: {grade}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="p-6">
                      <h3 className="font-semibold text-lg mb-2" data-testid={`course-title-${course.id}`}>
                        {course.title}
                      </h3>
                      <p className="text-muted-foreground text-sm mb-4 line-clamp-3">
                        {course.description}
                      </p>
                      
                      <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                        <div className="flex items-center space-x-1">
                          <Clock className="w-4 h-4" />
                          <span>{formatDuration(course.estimatedDuration)}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <BookOpen className="w-4 h-4" />
                          <span>{course.content.modules.length} modules</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Trophy className="w-4 h-4" />
                          <span>
                            {course.content.modules.filter(m => m.quiz && m.quiz.questions.length > 0).length} quizzes
                          </span>
                        </div>
                      </div>

                      {progress && !isCompleted && (
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center justify-between text-sm">
                            <span>Progress</span>
                            <span className="font-medium">{progressPercent}%</span>
                          </div>
                          <Progress value={progressPercent} className="h-2" />
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <Button
                          variant={isCompleted ? "outline" : "default"}
                          onClick={() => handleStartCourse(course)}
                          data-testid={`button-course-action-${course.id}`}
                        >
                          {isCompleted ? 'Review' : progress ? 'Continue' : 'Start'}
                        </Button>
                        
                        {(currentUser?.role === 'super_admin' || currentUser?.role === 'client_admin') && (
                          <div className="flex items-center space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              data-testid={`button-assign-course-${course.id}`}
                            >
                              <Users className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              data-testid={`button-edit-course-${course.id}`}
                            >
                              <BookOpen className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {courses.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No courses available</h3>
                <p className="text-muted-foreground mb-4">
                  Get started by creating your first cybersecurity training course
                </p>
                {(currentUser?.role === 'super_admin' || currentUser?.role === 'client_admin') && (
                  <div className="flex justify-center space-x-3">
                    <Button 
                      onClick={() => setShowGenerateDialog(true)}
                      data-testid="button-ai-generate-first"
                    >
                      <Wand2 className="w-4 h-4 mr-2" />
                      AI Generate Course
                    </Button>
                    <Button variant="outline" data-testid="button-create-first-course">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Manually
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        /* Course Player Interface */
        <Card>
          <CardContent className="p-0">
            {/* Module Content Area */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950 dark:to-indigo-900 p-8 min-h-[400px]">
              <div className="max-w-4xl mx-auto">
                <h2 className="text-2xl font-bold mb-4" data-testid="module-title">
                  {selectedCourse.content.modules[currentModule]?.title}
                </h2>
                <div 
                  className="prose dark:prose-invert max-w-none bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm"
                  dangerouslySetInnerHTML={{ 
                    __html: selectedCourse.content.modules[currentModule]?.content || 'Loading content...'
                  }}
                  data-testid="module-content"
                />
              </div>
            </div>
            
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold" data-testid="current-course-title">
                    {selectedCourse.title}
                  </h3>
                  <p className="text-muted-foreground">
                    Module {currentModule + 1}: {selectedCourse.content.modules[currentModule]?.title}
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setSelectedCourse(null)}
                  data-testid="button-close-course-player"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
              
              {/* Course Progress */}
              <div className="mb-6">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span>Course Progress</span>
                  <span className="font-medium" data-testid="course-progress-percentage">
                    {getCourseProgress(selectedCourse.id)?.progress || 0}%
                  </span>
                </div>
                <Progress 
                  value={getCourseProgress(selectedCourse.id)?.progress || 0} 
                  className="h-2" 
                />
              </div>

              {/* Module Navigation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">MODULES</h4>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {selectedCourse.content.modules.map((module, index) => {
                      const progress = getCourseProgress(selectedCourse.id);
                      const isCompleted = progress?.completedModules?.includes(index.toString()) || false;
                      const isCurrent = index === currentModule;
                      const quizScore = progress?.quizScores?.[`module-${index}`];
                      
                      return (
                        <div
                          key={module.id}
                          className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
                            isCurrent 
                              ? 'bg-accent/10 border-l-2 border-accent' 
                              : isCompleted 
                                ? 'bg-primary/10 border-l-2 border-primary hover:bg-primary/20'
                                : 'hover:bg-muted'
                          }`}
                          onClick={() => setCurrentModule(index)}
                          data-testid={`module-${index}`}
                        >
                          <div className="flex items-center space-x-3">
                            {isCompleted ? (
                              <CheckCircle className="w-4 h-4 text-primary" />
                            ) : isCurrent ? (
                              <Play className="w-4 h-4 text-accent" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border-2 border-muted-foreground" />
                            )}
                            <span className={`text-sm ${isCurrent ? 'font-medium' : ''}`}>
                              {index + 1}. {module.title}
                            </span>
                          </div>
                          {isCompleted && quizScore !== undefined && (
                            <Badge variant="secondary" className="text-xs">
                              {quizScore}%
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">MODULE QUIZ</h4>
                  {selectedCourse.content.modules[currentModule]?.quiz && 
                   selectedCourse.content.modules[currentModule].quiz!.questions.length > 0 ? (
                    <div className="p-4 border border-border rounded-lg">
                      <div className="flex items-start space-x-3">
                        <Award className="w-5 h-5 text-primary mt-1" />
                        <div className="flex-1">
                          <h5 className="font-medium text-sm mb-2">Module Assessment</h5>
                          <p className="text-xs text-muted-foreground mb-3">
                            Complete the quiz to test your knowledge and unlock the next module
                          </p>
                          <p className="text-xs text-muted-foreground mb-3">
                            {selectedCourse.content.modules[currentModule].quiz!.questions.length} questions • 
                            70% passing score
                          </p>
                          <Button 
                            className="w-full" 
                            size="sm"
                            onClick={() => setShowQuiz(true)}
                            data-testid="button-start-quiz"
                          >
                            <Trophy className="w-4 h-4 mr-2" />
                            Start Quiz
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 border border-border rounded-lg">
                      <p className="text-xs text-muted-foreground">
                        No quiz available for this module
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Course Controls */}
              <div className="flex items-center justify-between">
                <Button 
                  variant="outline"
                  disabled={currentModule === 0}
                  onClick={() => setCurrentModule(Math.max(0, currentModule - 1))}
                  data-testid="button-previous-module"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Previous
                </Button>
                
                <div className="flex items-center space-x-3">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    data-testid="button-bookmark-module"
                  >
                    <Bookmark className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    data-testid="button-take-notes"
                  >
                    <StickyNote className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    data-testid="button-share-module"
                  >
                    <Share className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="flex space-x-2">
                  <Button 
                    variant="outline"
                    onClick={handleModuleComplete}
                    data-testid="button-complete-module"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {selectedCourse.content.modules[currentModule]?.quiz?.questions?.length ? 'Take Quiz' : 'Complete'}
                  </Button>
                  <Button 
                    disabled={currentModule === selectedCourse.content.modules.length - 1}
                    onClick={() => setCurrentModule(Math.min(selectedCourse.content.modules.length - 1, currentModule + 1))}
                    data-testid="button-next-module"
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Course Generation Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>AI Course Generation</DialogTitle>
            <DialogDescription>
              Use AI to generate a comprehensive cybersecurity training course
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="topic">Course Topic</Label>
              <Input
                id="topic"
                placeholder="e.g., Ransomware Protection, Cloud Security..."
                value={generateFormData.topic}
                onChange={(e) => setGenerateFormData({...generateFormData, topic: e.target.value})}
                data-testid="input-course-topic"
              />
            </div>
            
            <div>
              <Label htmlFor="difficulty">Difficulty Level</Label>
              <Select 
                value={generateFormData.difficulty}
                onValueChange={(value) => setGenerateFormData({...generateFormData, difficulty: value})}
              >
                <SelectTrigger id="difficulty" data-testid="select-difficulty">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="modules">Number of Modules</Label>
              <Select 
                value={generateFormData.modules.toString()}
                onValueChange={(value) => setGenerateFormData({...generateFormData, modules: parseInt(value)})}
              >
                <SelectTrigger id="modules" data-testid="select-modules">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 Modules</SelectItem>
                  <SelectItem value="5">5 Modules</SelectItem>
                  <SelectItem value="7">7 Modules</SelectItem>
                  <SelectItem value="10">10 Modules</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setShowGenerateDialog(false)}
                disabled={generateCourseMutation.isPending}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleGenerateCourse}
                disabled={generateCourseMutation.isPending}
                data-testid="button-generate-course"
              >
                {generateCourseMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 mr-2" />
                    Generate Course
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}