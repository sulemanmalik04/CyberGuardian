import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [error, setError] = useState('');
  const { login, loading } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await login(email, password, subdomain);
    } catch (err: any) {
      const errorMessage = err.message || 'Login failed';
      setError(errorMessage);
      toast({
        title: 'Login Failed',
        description: errorMessage,
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary rounded-xl flex items-center justify-center">
            <svg 
              className="w-8 h-8 text-primary-foreground" 
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">CyberAware Pro</CardTitle>
            <p className="text-muted-foreground">
              Sign in to your cybersecurity training portal
            </p>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="login-form">
            {error && (
              <Alert variant="destructive" data-testid="error-alert">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                data-testid="input-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                data-testid="input-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subdomain">
                Company Portal 
                <span className="text-muted-foreground text-sm ml-1">(optional for super admins)</span>
              </Label>
              <div className="flex">
                <Input
                  id="subdomain"
                  type="text"
                  placeholder="company"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value)}
                  disabled={loading}
                  className="rounded-r-none"
                  data-testid="input-subdomain"
                />
                <div className="px-3 py-2 bg-muted border border-l-0 border-input rounded-r-md text-muted-foreground text-sm flex items-center">
                  .cyberaware.com
                </div>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
              data-testid="button-login"
            >
              {loading ? (
                <>
                  <div className="loading-spinner w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full mr-2"></div>
                  Signing In...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm7.707 3.293a1 1 0 010 1.414L9.414 9H17a1 1 0 110 2H9.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Sign In
                </>
              )}
            </Button>

            <div className="text-center space-y-4 pt-4">
              <div className="text-sm text-muted-foreground">
                Demo Accounts:
              </div>
              <div className="grid grid-cols-1 gap-2 text-xs">
                <div className="p-2 bg-muted/50 rounded border">
                  <strong>Super Admin:</strong> admin@cyberaware.com / admin123
                </div>
                <div className="p-2 bg-muted/50 rounded border">
                  <strong>Client Admin:</strong> admin@techcorp.com / admin123 (techcorp)
                </div>
                <div className="p-2 bg-muted/50 rounded border">
                  <strong>End User:</strong> user@techcorp.com / user123 (techcorp)
                </div>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
