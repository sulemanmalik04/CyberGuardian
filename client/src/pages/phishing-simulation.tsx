import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Shield, AlertTriangle, CheckCircle, Info, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

export default function PhishingSimulation() {
  const [, setLocation] = useLocation();
  const [showDetails, setShowDetails] = useState(false);
  const [timeSpent, setTimeSpent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeSpent(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Warning Banner */}
        <Alert className="mb-6 bg-red-100 dark:bg-red-900 border-red-300 dark:border-red-700">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <AlertDescription className="text-red-800 dark:text-red-200 font-semibold text-lg">
            ⚠️ You just clicked on a simulated phishing link!
          </AlertDescription>
        </Alert>

        {/* Main Content Card */}
        <Card className="shadow-xl" data-testid="phishing-simulation-card">
          <CardHeader className="bg-gradient-to-r from-red-500 to-orange-500 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="h-8 w-8" />
                <CardTitle className="text-2xl">Security Awareness Training</CardTitle>
              </div>
              <Badge variant="secondary" className="bg-white text-red-600">
                SIMULATION
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent className="p-6 space-y-6">
            {/* Impact Message */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                What Just Happened?
              </h3>
              <p className="text-gray-700 dark:text-gray-300">
                In a real phishing attack, clicking this link could have:
              </p>
              <ul className="mt-2 space-y-1 text-gray-600 dark:text-gray-400">
                <li>• Stolen your login credentials</li>
                <li>• Installed malware on your device</li>
                <li>• Compromised sensitive company data</li>
                <li>• Given attackers access to your accounts</li>
              </ul>
            </div>

            {/* Time Tracker */}
            <div className="flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Time on this page:</p>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400" data-testid="time-spent">
                  {formatTime(timeSpent)}
                </p>
              </div>
            </div>

            {/* Learning Section */}
            <div className="space-y-4">
              <Button
                onClick={() => setShowDetails(!showDetails)}
                className="w-full"
                variant="outline"
                data-testid="button-show-details"
              >
                {showDetails ? 'Hide' : 'Show'} Red Flags to Watch For
                <Info className="ml-2 h-4 w-4" />
              </Button>

              {showDetails && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Info className="h-5 w-5 text-blue-600" />
                      Common Phishing Red Flags:
                    </h4>
                    <div className="grid md:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <X className="h-4 w-4 text-red-500 mt-1 flex-shrink-0" />
                          <div>
                            <p className="font-medium">Suspicious Sender</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Check if the email address matches the organization
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <X className="h-4 w-4 text-red-500 mt-1 flex-shrink-0" />
                          <div>
                            <p className="font-medium">Urgency Pressure</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              "Act now or lose access" is a common tactic
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <X className="h-4 w-4 text-red-500 mt-1 flex-shrink-0" />
                          <div>
                            <p className="font-medium">Generic Greeting</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              "Dear Customer" instead of your name
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <X className="h-4 w-4 text-red-500 mt-1 flex-shrink-0" />
                          <div>
                            <p className="font-medium">Spelling/Grammar Errors</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Professional emails rarely have mistakes
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <X className="h-4 w-4 text-red-500 mt-1 flex-shrink-0" />
                          <div>
                            <p className="font-medium">Suspicious Links</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Hover over links to see the real destination
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <X className="h-4 w-4 text-red-500 mt-1 flex-shrink-0" />
                          <div>
                            <p className="font-medium">Unexpected Attachments</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Don't open files you weren't expecting
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      What To Do If You're Unsure:
                    </h4>
                    <ol className="space-y-2 text-gray-700 dark:text-gray-300">
                      <li>1. <strong>Don't click links</strong> - Type the URL directly or use bookmarks</li>
                      <li>2. <strong>Verify the sender</strong> - Contact them through a known channel</li>
                      <li>3. <strong>Check with IT</strong> - When in doubt, ask your IT security team</li>
                      <li>4. <strong>Report suspicious emails</strong> - Use the phishing report button</li>
                      <li>5. <strong>Delete the email</strong> - If confirmed phishing, delete immediately</li>
                    </ol>
                  </div>
                </div>
              )}
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
                onClick={() => setLocation('/courses')}
                className="flex-1"
                variant="outline"
                data-testid="button-security-training"
              >
                Take Security Training
              </Button>
            </div>

            {/* Footer Note */}
            <div className="text-center text-sm text-gray-500 dark:text-gray-400 pt-4 border-t">
              <p>
                This was a simulated phishing test conducted by your organization's security team.
                No actual harm was done, but please be more careful with suspicious emails in the future.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}