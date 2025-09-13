import { apiRequest } from './queryClient';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  department?: string;
  language: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  subdomain: string;
  branding: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    backgroundColor?: string;
    companyName?: string;
    emailFooter?: string;
    supportEmail?: string;
    customCss?: string;
    darkModeEnabled?: boolean;
  };
  licenseStatus: string;
  expirationDate?: string;
  maxUsers: number;
  createdAt: string;
  updatedAt: string;
}

export interface Course {
  id: string;
  title: string;
  description?: string;
  content: {
    modules: Array<{
      id: string;
      title: string;
      videoUrl?: string;
      content: string;
      duration: number;
      quiz?: {
        questions: Array<{
          question: string;
          options: string[];
          correctAnswer: number;
        }>;
      };
    }>;
  };
  language: string;
  difficulty: string;
  estimatedDuration?: number;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PhishingCampaign {
  id: string;
  clientId: string;
  name: string;
  template: {
    subject: string;
    htmlContent: string;
    textContent: string;
    fromName: string;
    fromEmail: string;
    domain: string;
  };
  targetGroups: string[];
  scheduledAt?: string;
  status: string;
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  emailsReported: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProgress {
  id: string;
  userId: string;
  courseId: string;
  progress: number;
  completedModules: string[];
  currentModule: number;
  quizScores: Record<string, number>;
  isCompleted: boolean;
  completedAt?: string;
  startedAt: string;
  lastAccessedAt: string;
}

export interface AnalyticsEvent {
  id: string;
  clientId?: string;
  userId?: string;
  campaignId?: string;
  courseId?: string;
  eventType: string;
  metadata: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

export interface PlatformAnalytics {
  summary: {
    totalClients: number;
    activeClients: number;
    totalUsers: number;
    totalActiveUsers: number;
    platformEngagementRate: number;
    totalCompletedCourses: number;
    totalPhishingClicks: number;
    totalPhishingReports: number;
    phishingSuccessRate: number;
  };
  clients: Array<{
    clientId: string;
    clientName: string;
    subdomain: string;
    totalUsers: number;
    activeUsers: number;
    licenseStatus: string;
    expirationDate: string | null;
    completedCourses: number;
    phishingClicks: number;
    phishingReports: number;
    lastActivity: string | null;
  }>;
  dateRange: {
    start: string;
    end: string;
  };
}

export interface DepartmentAnalytics {
  name: string;
  totalUsers: number;
  activeUsers: number;
  completedCourses: number;
  phishingClicks: number;
  phishingReports: number;
  avgQuizScore: number;
  completionRate: number;
  riskScore: number;
}

export interface AnalyticsSummary {
  users: {
    total: number;
    active: number;
    inactive: number;
    engagementRate: number;
  };
  training: {
    totalCourses: number;
    completedCourses: number;
    completionRate: number;
    avgQuizScore: number;
    quizzesTaken: number;
  };
  phishing: {
    totalCampaigns: number;
    activeCampaigns: number;
    emailsSent: number;
    emailsClicked: number;
    emailsReported: number;
    clickRate: number;
    reportRate: number;
  };
  trends: {
    weeklyActivity: number;
    monthlyActivity: number;
    weeklyGrowth: number;
  };
  dateRange: {
    start: string;
    end: string;
  };
}

// API functions
export const api = {
  // Authentication
  async login(email: string, password: string, subdomain?: string) {
    const response = await apiRequest('POST', '/api/auth/login', {
      email,
      password,
      subdomain
    });
    return response.json();
  },

  async logout() {
    const response = await apiRequest('POST', '/api/auth/logout');
    return response.json();
  },

  // Users
  async getUsers(clientId?: string): Promise<User[]> {
    const url = clientId ? `/api/users?clientId=${clientId}` : '/api/users';
    const response = await apiRequest('GET', url);
    return response.json();
  },

  async createUser(userData: Partial<User>): Promise<User> {
    const response = await apiRequest('POST', '/api/users', userData);
    return response.json();
  },

  async updateUser(id: string, userData: Partial<User>): Promise<User> {
    const response = await apiRequest('PUT', `/api/users/${id}`, userData);
    return response.json();
  },

  async deleteUser(id: string): Promise<void> {
    const response = await apiRequest('DELETE', `/api/users/${id}`);
    return response.json();
  },

  async previewUsersFromCSV(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch('/api/users/preview-csv', {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      }
    });
    
    return response.json();
  },

  async importUsersFromCSV(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch('/api/users/import-csv', {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      }
    });
    
    return response.json();
  },

  // Clients
  async getClients(): Promise<Client[]> {
    const response = await apiRequest('GET', '/api/clients');
    return response.json();
  },

  async createClient(clientData: Partial<Client>): Promise<Client> {
    const response = await apiRequest('POST', '/api/clients', clientData);
    return response.json();
  },

  async updateClient(id: string, updates: Partial<Client>): Promise<Client> {
    const response = await apiRequest('PUT', `/api/clients/${id}`, updates);
    return response.json();
  },

  async createClientWithAdmin(data: {
    client: Partial<Client>;
    admin: {
      email: string;
      firstName: string;
      lastName: string;
      password: string;
    };
  }): Promise<{ client: Client; admin: User }> {
    const response = await apiRequest('POST', '/api/clients/with-admin', data);
    return response.json();
  },

  async suspendClient(id: string): Promise<Client> {
    const response = await apiRequest('POST', `/api/clients/${id}/suspend`);
    return response.json();
  },

  async renewClient(id: string, expirationDate: string): Promise<Client> {
    const response = await apiRequest('POST', `/api/clients/${id}/renew`, { expirationDate });
    return response.json();
  },

  async checkSubdomainAvailability(subdomain: string): Promise<{ available: boolean }> {
    const response = await apiRequest('GET', `/api/clients/check-subdomain/${subdomain}`);
    return response.json();
  },

  // Courses
  async getCourses(language?: string): Promise<Course[]> {
    const url = language ? `/api/courses?language=${language}` : '/api/courses';
    const response = await apiRequest('GET', url);
    return response.json();
  },

  async getPublishedCourses(): Promise<Course[]> {
    const response = await apiRequest('GET', '/api/courses/published');
    return response.json();
  },

  async createCourse(courseData: Partial<Course>): Promise<Course> {
    const response = await apiRequest('POST', '/api/courses', courseData);
    return response.json();
  },

  async generateCourse(topic: string, difficulty: string, modules: number): Promise<Course> {
    const response = await apiRequest('POST', '/api/courses/generate', {
      topic,
      difficulty,
      modules
    });
    return response.json();
  },

  // User Progress
  async getUserProgress(userId: string): Promise<UserProgress[]> {
    const response = await apiRequest('GET', `/api/progress/${userId}`);
    return response.json();
  },

  async updateUserProgress(userId: string, courseId: string, updates: Partial<UserProgress>): Promise<UserProgress> {
    const response = await apiRequest('PUT', `/api/progress/${userId}/${courseId}`, updates);
    return response.json();
  },

  // Quiz Management
  async submitQuizScore(userId: string, courseId: string, moduleId: string, score: number, answers: any[]): Promise<UserProgress> {
    const response = await apiRequest('POST', '/api/quiz/submit', {
      userId,
      courseId,
      moduleId,
      score,
      answers
    });
    return response.json();
  },

  async generateQuizForModule(moduleContent: string, questionCount?: number) {
    const response = await apiRequest('POST', '/api/quiz/generate', {
      moduleContent,
      questionCount
    });
    return response.json();
  },

  // Phishing Campaigns
  async getCampaigns(clientId?: string): Promise<PhishingCampaign[]> {
    const url = clientId ? `/api/campaigns?clientId=${clientId}` : '/api/campaigns';
    const response = await apiRequest('GET', url);
    return response.json();
  },

  async createCampaign(campaignData: Partial<PhishingCampaign>): Promise<PhishingCampaign> {
    const response = await apiRequest('POST', '/api/campaigns', campaignData);
    return response.json();
  },

  async launchCampaign(campaignId: string) {
    const response = await apiRequest('POST', `/api/campaigns/${campaignId}/launch`);
    return response.json();
  },

  // Analytics
  async getAnalytics(clientId?: string, startDate?: string, endDate?: string): Promise<AnalyticsEvent[]> {
    let url = '/api/analytics';
    const params = new URLSearchParams();
    
    if (clientId) params.append('clientId', clientId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    if (params.toString()) {
      url += '?' + params.toString();
    }
    
    const response = await apiRequest('GET', url);
    return response.json();
  },

  async getPlatformAnalytics(startDate?: string, endDate?: string): Promise<PlatformAnalytics> {
    const params = new URLSearchParams();
    if (startDate) params.append('start', startDate);
    if (endDate) params.append('end', endDate);
    
    const url = params.toString() ? `/api/analytics/platform?${params}` : '/api/analytics/platform';
    const response = await apiRequest('GET', url);
    return response.json();
  },

  async getDepartmentAnalytics(startDate?: string, endDate?: string): Promise<DepartmentAnalytics[]> {
    const params = new URLSearchParams();
    if (startDate) params.append('start', startDate);
    if (endDate) params.append('end', endDate);
    
    const url = params.toString() ? `/api/analytics/departments?${params}` : '/api/analytics/departments';
    const response = await apiRequest('GET', url);
    return response.json();
  },

  async getAnalyticsSummary(startDate?: string, endDate?: string): Promise<AnalyticsSummary> {
    const params = new URLSearchParams();
    if (startDate) params.append('start', startDate);
    if (endDate) params.append('end', endDate);
    
    const url = params.toString() ? `/api/analytics/summary?${params}` : '/api/analytics/summary';
    const response = await apiRequest('GET', url);
    return response.json();
  },

  async exportAnalyticsCSV(type: 'events' | 'users', startDate?: string, endDate?: string): Promise<Blob> {
    const params = new URLSearchParams();
    params.append('type', type);
    if (startDate) params.append('start', startDate);
    if (endDate) params.append('end', endDate);
    
    const response = await fetch(`/api/analytics/export/csv?${params}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to export analytics');
    }
    return response.blob();
  },

  // AI
  async chatWithAI(message: string, context?: any) {
    const response = await apiRequest('POST', '/api/ai/chat', {
      message,
      context
    });
    return response.json();
  },

  async getAIRecommendations() {
    const response = await apiRequest('POST', '/api/ai/recommendations');
    return response.json();
  },

  // File Upload
  async uploadLogo(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('logo', file);
    
    const response = await fetch('/api/upload/logo', {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Logo upload failed');
    }
    
    const result = await response.json();
    return result.url;
  }
};
