import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  ChevronLeft, 
  ChevronRight,
  RotateCcw,
  Award,
  AlertTriangle
} from 'lucide-react';

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
}

interface QuizAnswer {
  questionIndex: number;
  selectedAnswer: number;
  isCorrect: boolean;
}

interface QuizComponentProps {
  moduleTitle: string;
  questions: QuizQuestion[];
  onQuizComplete: (score: number, answers: QuizAnswer[], timeTaken: number) => void;
  onQuizCancel: () => void;
  passingScore?: number;
  timeLimit?: number; // in minutes
}

export default function QuizComponent({
  moduleTitle,
  questions,
  onQuizComplete,
  onQuizCancel,
  passingScore = 70,
  timeLimit
}: QuizComponentProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(new Array(questions.length).fill(null));
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [quizResults, setQuizResults] = useState<{
    score: number;
    answers: QuizAnswer[];
    timeTaken: number;
    passed: boolean;
  } | null>(null);
  const [startTime] = useState(Date.now());
  const [timeRemaining, setTimeRemaining] = useState(timeLimit ? timeLimit * 60 : null);

  // Timer effect for time-limited quizzes
  useState(() => {
    if (timeLimit && timeRemaining !== null) {
      const interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev === null || prev <= 1) {
            handleSubmitQuiz();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  });

  const handleAnswerSelect = (questionIndex: number, answerIndex: number) => {
    if (isSubmitted) return;
    
    const newAnswers = [...answers];
    newAnswers[questionIndex] = answerIndex;
    setAnswers(newAnswers);
  };

  const getAnsweredCount = () => {
    return answers.filter(answer => answer !== null).length;
  };

  const canSubmitQuiz = () => {
    return getAnsweredCount() === questions.length;
  };

  const handleSubmitQuiz = () => {
    if (isSubmitted || !canSubmitQuiz()) return;

    const timeTaken = Math.round((Date.now() - startTime) / 1000);
    const quizAnswers: QuizAnswer[] = answers.map((selectedAnswer, questionIndex) => ({
      questionIndex,
      selectedAnswer: selectedAnswer!,
      isCorrect: selectedAnswer === questions[questionIndex].correctAnswer
    }));

    const correctAnswers = quizAnswers.filter(a => a.isCorrect).length;
    const score = Math.round((correctAnswers / questions.length) * 100);
    const passed = score >= passingScore;

    const results = {
      score,
      answers: quizAnswers,
      timeTaken,
      passed
    };

    setQuizResults(results);
    setIsSubmitted(true);
    onQuizComplete(score, quizAnswers, timeTaken);
  };

  const handleRetakeQuiz = () => {
    setCurrentQuestionIndex(0);
    setAnswers(new Array(questions.length).fill(null));
    setIsSubmitted(false);
    setQuizResults(null);
    setTimeRemaining(timeLimit ? timeLimit * 60 : null);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const currentQuestion = questions[currentQuestionIndex];

  if (isSubmitted && quizResults) {
    return (
      <Card className="max-w-4xl mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center space-x-2">
            {quizResults.passed ? (
              <CheckCircle className="w-6 h-6 text-green-600" />
            ) : (
              <XCircle className="w-6 h-6 text-red-600" />
            )}
            <span>Quiz {quizResults.passed ? 'Passed' : 'Failed'}</span>
          </CardTitle>
          <p className="text-muted-foreground">{moduleTitle}</p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Score Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-4 border rounded-lg">
              <div className={`text-2xl font-bold ${quizResults.passed ? 'text-green-600' : 'text-red-600'}`}>
                {quizResults.score}%
              </div>
              <div className="text-sm text-muted-foreground">Score</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {quizResults.answers.filter(a => a.isCorrect).length}/{questions.length}
              </div>
              <div className="text-sm text-muted-foreground">Correct</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-2xl font-bold text-gray-600">
                {formatTime(quizResults.timeTaken)}
              </div>
              <div className="text-sm text-muted-foreground">Time</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {passingScore}%
              </div>
              <div className="text-sm text-muted-foreground">Required</div>
            </div>
          </div>

          {/* Pass/Fail Status */}
          <div className={`p-4 rounded-lg border-l-4 ${
            quizResults.passed 
              ? 'bg-green-50 border-green-500 dark:bg-green-900/20' 
              : 'bg-red-50 border-red-500 dark:bg-red-900/20'
          }`}>
            <div className="flex items-center space-x-3">
              {quizResults.passed ? (
                <Award className="w-6 h-6 text-green-600" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-red-600" />
              )}
              <div>
                <h3 className="font-semibold">
                  {quizResults.passed ? 'Congratulations!' : 'Quiz Not Passed'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {quizResults.passed 
                    ? 'You have successfully completed this module quiz.'
                    : `You need ${passingScore}% or higher to pass. Review the material and try again.`
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Detailed Results */}
          <div className="space-y-4">
            <h4 className="font-semibold">Question Review</h4>
            {questions.map((question, index) => {
              const userAnswer = quizResults.answers[index];
              const isCorrect = userAnswer.isCorrect;
              
              return (
                <Card key={index} className={`border-l-4 ${
                  isCorrect ? 'border-green-500' : 'border-red-500'
                }`}>
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      {isCorrect ? (
                        <CheckCircle className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600 mt-1 flex-shrink-0" />
                      )}
                      <div className="flex-1 space-y-2">
                        <div className="font-medium">
                          Question {index + 1}: {question.question}
                        </div>
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center space-x-2">
                            <span>Your answer:</span>
                            <Badge variant={isCorrect ? 'default' : 'destructive'}>
                              {question.options[userAnswer.selectedAnswer]}
                            </Badge>
                          </div>
                          {!isCorrect && (
                            <div className="flex items-center space-x-2">
                              <span>Correct answer:</span>
                              <Badge variant="default">
                                {question.options[question.correctAnswer]}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4">
            <Button 
              variant="outline"
              onClick={onQuizCancel}
              data-testid="button-quiz-exit"
            >
              {quizResults.passed ? 'Continue Learning' : 'Back to Module'}
            </Button>
            
            <div className="flex space-x-2">
              {!quizResults.passed && (
                <Button 
                  onClick={handleRetakeQuiz}
                  data-testid="button-retake-quiz"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Retake Quiz
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">
            Module Quiz: {moduleTitle}
          </CardTitle>
          {timeRemaining !== null && (
            <Badge variant={timeRemaining < 300 ? 'destructive' : 'default'} className="text-sm">
              <Clock className="w-4 h-4 mr-1" />
              {formatTime(timeRemaining)}
            </Badge>
          )}
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Question {currentQuestionIndex + 1} of {questions.length}</span>
            <span>{getAnsweredCount()}/{questions.length} answered</span>
          </div>
          <Progress 
            value={(currentQuestionIndex + 1) / questions.length * 100} 
            className="h-2" 
          />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Current Question */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium" data-testid="quiz-question">
            {currentQuestion.question}
          </h3>
          
          <RadioGroup
            value={answers[currentQuestionIndex]?.toString() || ""}
            onValueChange={(value) => handleAnswerSelect(currentQuestionIndex, parseInt(value))}
            className="space-y-3"
          >
            {currentQuestion.options.map((option, optionIndex) => (
              <div 
                key={optionIndex} 
                className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent/50 cursor-pointer"
                onClick={() => handleAnswerSelect(currentQuestionIndex, optionIndex)}
              >
                <RadioGroupItem 
                  value={optionIndex.toString()} 
                  id={`option-${optionIndex}`}
                  data-testid={`quiz-option-${optionIndex}`}
                />
                <Label 
                  htmlFor={`option-${optionIndex}`} 
                  className="flex-1 cursor-pointer"
                >
                  {option}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* Question Overview */}
        <div className="border-t pt-4">
          <h4 className="font-medium text-sm text-muted-foreground mb-2">Question Overview</h4>
          <div className="grid grid-cols-10 gap-1">
            {questions.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentQuestionIndex(index)}
                className={`aspect-square text-xs rounded ${
                  index === currentQuestionIndex
                    ? 'bg-primary text-primary-foreground'
                    : answers[index] !== null
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-muted hover:bg-muted/80'
                }`}
                data-testid={`question-nav-${index}`}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Navigation Controls */}
        <div className="flex items-center justify-between pt-4">
          <Button 
            variant="outline"
            onClick={onQuizCancel}
            data-testid="button-cancel-quiz"
          >
            Cancel Quiz
          </Button>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              disabled={currentQuestionIndex === 0}
              onClick={() => setCurrentQuestionIndex(currentQuestionIndex - 1)}
              data-testid="button-previous-question"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            
            {currentQuestionIndex < questions.length - 1 ? (
              <Button
                onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}
                data-testid="button-next-question"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmitQuiz}
                disabled={!canSubmitQuiz()}
                className="bg-green-600 hover:bg-green-700"
                data-testid="button-submit-quiz"
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Submit Quiz
              </Button>
            )}
          </div>
        </div>

        {/* Submit Warning */}
        {!canSubmitQuiz() && (
          <div className="p-3 bg-amber-50 border-l-4 border-amber-500 dark:bg-amber-900/20">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="text-sm text-amber-700 dark:text-amber-300">
                Please answer all questions before submitting the quiz.
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}