import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Shield, Award, CheckCircle, TrendingUp, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

export default function PhishingReported() {
  const [, setLocation] = useLocation();
  const [showConfetti, setShowConfetti] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Animate progress bar
    const timer = setTimeout(() => setProgress(100), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Hide confetti after 3 seconds
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-950 dark:to-blue-950 p-4 md:p-8">
      {/* Confetti Animation */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50">
          <div className="confetti-container">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="confetti"
                style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  backgroundColor: ['#10B981', '#3B82F6', '#F59E0B', '#EF4444'][Math.floor(Math.random() * 4)]
                }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        {/* Success Banner */}
        <Alert className="mb-6 bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-200 font-semibold text-lg">
            🎉 Excellent work! You successfully identified and reported a phishing attempt!
          </AlertDescription>
        </Alert>

        {/* Main Content Card */}
        <Card className="shadow-xl" data-testid="phishing-reported-card">
          <CardHeader className="bg-gradient-to-r from-green-500 to-blue-500 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="h-8 w-8" />
                <CardTitle className="text-2xl">Security Champion!</CardTitle>
              </div>
              <Badge variant="secondary" className="bg-white text-green-600">
                REPORTED
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent className="p-6 space-y-6">
            {/* Achievement Section */}
            <div className="text-center p-6 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg">
              <Award className="h-16 w-16 text-yellow-500 mx-auto mb-3" />
              <h3 className="text-2xl font-bold mb-2">You're a Security Hero!</h3>
              <p className="text-gray-600 dark:text-gray-400">
                You've helped protect your organization from a potential security threat.
              </p>
              <div className="flex justify-center gap-1 mt-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-6 w-6 text-yellow-400 fill-current" />
                ))}
              </div>
            </div>

            {/* Progress Section */}
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Security Awareness Level</span>
                <span className="font-semibold text-green-600">Expert</span>
              </div>
              <Progress value={progress} className="h-3" />
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                You're in the top 10% of security-aware employees!
              </p>
            </div>

            {/* Why This Matters */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                Why Your Action Matters:
              </h4>
              <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                  <span>You prevented potential data breach that could cost millions</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                  <span>Protected sensitive company and customer information</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                  <span>Helped identify attack patterns for future prevention</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                  <span>Set a great example for your colleagues</span>
                </li>
              </ul>
            </div>

            {/* Tips for Continued Vigilance */}
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <h4 className="font-semibold mb-3">Keep Up the Great Work!</h4>
              <p className="text-gray-600 dark:text-gray-400 mb-3">
                Remember these key practices:
              </p>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="h-6">1</Badge>
                  <span className="text-sm">Always verify sender identity</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="h-6">2</Badge>
                  <span className="text-sm">Check URLs before clicking</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="h-6">3</Badge>
                  <span className="text-sm">Report suspicious emails</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="h-6">4</Badge>
                  <span className="text-sm">Keep software updated</span>
                </div>
              </div>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border">
                <p className="text-2xl font-bold text-green-600" data-testid="stat-phishing-caught">97%</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Phishing Caught</p>
              </div>
              <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border">
                <p className="text-2xl font-bold text-blue-600" data-testid="stat-reports">12</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Reports This Month</p>
              </div>
              <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border">
                <p className="text-2xl font-bold text-purple-600" data-testid="stat-streak">5</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Day Streak</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <Button
                onClick={() => setLocation('/dashboard')}
                className="flex-1"
                variant="default"
                data-testid="button-back-dashboard"
              >
                Return to Dashboard
              </Button>
              <Button
                onClick={() => setLocation('/analytics')}
                className="flex-1"
                variant="outline"
                data-testid="button-view-analytics"
              >
                View Your Security Score
              </Button>
            </div>

            {/* Footer Note */}
            <div className="text-center text-sm text-gray-500 dark:text-gray-400 pt-4 border-t">
              <p>
                Thank you for being vigilant! Your quick action helps keep our organization safe.
                This was a simulated phishing test - keep up the excellent security awareness!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(-100vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        
        .confetti {
          position: absolute;
          width: 10px;
          height: 10px;
          animation: confetti-fall 3s linear;
        }
      `}</style>
    </div>
  );
}