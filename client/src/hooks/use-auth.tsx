import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'super_admin' | 'client_admin' | 'end_user';
  clientId?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, subdomain?: string) => Promise<void>;
  logout: () => Promise<void>;
  token: string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('auth_token')
  );
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  // Fetch user data when token exists
  const { data: user, isLoading: loading } = useQuery({
    queryKey: ['user', token],
    queryFn: async () => {
      if (!token) return null;
      
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        localStorage.removeItem('auth_token');
        setToken(null);
        return null;
      }
      
      return response.json();
    },
    enabled: !!token,
    retry: false
  });

  const loginMutation = useMutation({
    mutationFn: async ({ email, password, subdomain }: { 
      email: string; 
      password: string; 
      subdomain?: string 
    }) => {
      const response = await apiRequest('POST', '/api/auth/login', {
        email,
        password,
        subdomain
      });
      return response.json();
    },
    onSuccess: (data) => {
      setToken(data.token);
      localStorage.setItem('auth_token', data.token);
      queryClient.setQueryData(['user', data.token], data.user);
      navigate('/dashboard');
    }
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      if (token) {
        await apiRequest('POST', '/api/auth/logout', {});
      }
    },
    onSettled: () => {
      setToken(null);
      localStorage.removeItem('auth_token');
      queryClient.clear();
      navigate('/login');
    }
  });

  const login = async (email: string, password: string, subdomain?: string) => {
    await loginMutation.mutateAsync({ email, password, subdomain });
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  // Set up axios interceptor for token
  useEffect(() => {
    const originalFetch = window.fetch;
    
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      
      const response = await originalFetch(input, {
        ...init,
        headers
      });
      
      // Handle token expiration
      if (response.status === 403 && token) {
        setToken(null);
        localStorage.removeItem('auth_token');
        navigate('/login');
      }
      
      return response;
    };
    
    return () => {
      window.fetch = originalFetch;
    };
  }, [token, navigate]);

  const contextValue: AuthContextType = {
    user: user || null,
    loading: loading || loginMutation.isPending || logoutMutation.isPending,
    login,
    logout,
    token
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
