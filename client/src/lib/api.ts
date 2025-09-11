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
  async uploadLogo(file: File): Promise<{ logoUrl: string }> {
    const formData = new FormData();
    formData.append('logo', file);
    
    const response = await fetch('/api/upload/logo', {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      }
    });
    
    return response.json();
  }
};
