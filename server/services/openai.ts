import OpenAI from "openai";
import type { User, UserCourseProgress } from "@shared/schema";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR;
const isDevelopment = process.env.NODE_ENV === 'development';

// Initialize OpenAI client only if API key is available
let openai: OpenAI | null = null;

if (OPENAI_API_KEY) {
  openai = new OpenAI({ 
    apiKey: OPENAI_API_KEY 
  });
} else if (!isDevelopment) {
  throw new Error("OPENAI_API_KEY environment variable must be set in production");
}

interface GeneratedCourse {
  title: string;
  description: string;
  modules: Array<{
    id: string;
    title: string;
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
  estimatedDuration: number;
}

interface LearningRecommendation {
  courseId?: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
}

class OpenAIService {
  async generateCourse(topic: string, difficulty: string, moduleCount: number = 5): Promise<GeneratedCourse> {
    if (!openai) {
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
    }
    
    try {
      const prompt = `Create a comprehensive cybersecurity training course about "${topic}" at ${difficulty} level with ${moduleCount} modules. 
      
      Focus on practical, actionable content that helps employees recognize and respond to cybersecurity threats.
      
      Return the response in JSON format with this structure:
      {
        "title": "Course title",
        "description": "Course description",
        "modules": [
          {
            "id": "module-1",
            "title": "Module title",
            "content": "Detailed module content in HTML format",
            "duration": 15,
            "quiz": {
              "questions": [
                {
                  "question": "Question text",
                  "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
                  "correctAnswer": 0
                }
              ]
            }
          }
        ],
        "estimatedDuration": 75
      }`;

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are a cybersecurity training expert. Create engaging, practical courses that help employees stay secure."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 4000
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('No content received from OpenAI');
      }
      const courseData = JSON.parse(content);
      return courseData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Course generation failed: ${errorMessage}`);
    }
  }

  async generateQuizQuestions(moduleContent: string, questionCount: number = 5): Promise<Array<{
    question: string;
    options: string[];
    correctAnswer: number;
  }>> {
    if (!openai) {
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
    }
    
    try {
      const prompt = `Based on the following cybersecurity training content, generate ${questionCount} multiple-choice questions that test understanding of key concepts:

      Content: ${moduleContent}

      Return the response in JSON format:
      {
        "questions": [
          {
            "question": "Question text",
            "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
            "correctAnswer": 0
          }
        ]
      }`;

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are a cybersecurity education expert. Create challenging but fair quiz questions that test practical knowledge."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" }
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('No content received from OpenAI');
      }
      const quizData = JSON.parse(content);
      return quizData.questions;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Quiz generation failed: ${errorMessage}`);
    }
  }

  async chatWithUser(message: string, user: User, context?: any): Promise<string> {
    if (!openai) {
      return 'I apologize, but the AI assistant is not available at the moment. Please contact your administrator for assistance.';
    }
    
    try {
      let systemPrompt = `You are a helpful cybersecurity training assistant. You help users with cybersecurity awareness, training recommendations, and answering security-related questions.

      User context:
      - Role: ${user.role}
      - Name: ${user.firstName} ${user.lastName}
      - Department: ${user.department || 'Not specified'}`;

      if (user.role === 'client_admin' || user.role === 'super_admin') {
        systemPrompt += `\n\nAs an admin, you can help with:
        - Creating and managing training campaigns
        - Analyzing user performance and security awareness
        - Setting up phishing simulations
        - Generating custom training content
        - Interpreting security metrics and reports`;
      } else {
        systemPrompt += `\n\nAs an end user, I can help you with:
        - Understanding cybersecurity threats and best practices
        - Explaining training content and concepts
        - Providing personalized learning recommendations
        - Answering questions about phishing, passwords, and security policies`;
      }

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: message
          }
        ],
        max_tokens: 500
      });

      const content = response.choices[0].message.content;
      return content || 'I apologize, but I couldn\'t generate a response. Please try again.';
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`AI chat failed: ${errorMessage}`);
    }
  }

  async generateLearningRecommendations(user: User, userProgress: UserCourseProgress[]): Promise<LearningRecommendation[]> {
    if (!openai) {
      // Return default recommendations when OpenAI is not available
      return [
        {
          title: 'Password Security Fundamentals',
          description: 'Learn how to create and manage strong passwords',
          priority: 'high' as const,
          reason: 'Essential security foundation for all users'
        },
        {
          title: 'Email Security and Phishing Recognition',
          description: 'Identify and respond to suspicious emails',
          priority: 'high' as const,
          reason: 'Protect against common phishing attacks'
        }
      ];
    }
    
    try {
      const progressSummary = userProgress.map(p => ({
        courseId: p.courseId,
        progress: p.progress,
        completed: p.isCompleted,
        quizScores: p.quizScores
      }));

      const prompt = `Based on the user's current training progress and role, recommend 3-5 cybersecurity training courses or modules they should focus on next.

      User Role: ${user.role}
      Department: ${user.department || 'Not specified'}
      Current Progress: ${JSON.stringify(progressSummary)}

      Consider:
      - Gaps in their current knowledge
      - Role-specific security risks
      - Areas where they might be struggling (low quiz scores)
      - Progressive learning path from basic to advanced topics

      Return recommendations in JSON format:
      {
        "recommendations": [
          {
            "title": "Recommended course/module title",
            "description": "Why this is recommended",
            "priority": "high|medium|low",
            "reason": "Specific reason based on their progress/role"
          }
        ]
      }`;

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are a personalized learning advisor for cybersecurity training. Make thoughtful recommendations based on user data."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" }
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('No content received from OpenAI');
      }
      const recommendationsData = JSON.parse(content);
      return recommendationsData.recommendations;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Recommendation generation failed: ${errorMessage}`);
    }
  }

  async generatePhishingEmail(template: string, difficulty: 'easy' | 'medium' | 'hard'): Promise<{
    subject: string;
    htmlContent: string;
    textContent: string;
  }> {
    if (!openai) {
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
    }
    
    try {
      const prompt = `Generate a realistic phishing email simulation for cybersecurity training at ${difficulty} difficulty level.

      Template type: ${template}
      
      Make it realistic but educational. Include subtle red flags that trained users should catch.
      
      For ${difficulty} difficulty:
      - Easy: Obvious spelling errors, generic greetings, suspicious domains
      - Medium: Better grammar but still suspicious elements, urgent language
      - Hard: Professional appearance with subtle inconsistencies
      
      Return in JSON format:
      {
        "subject": "Email subject line",
        "htmlContent": "Full HTML email content",
        "textContent": "Plain text version"
      }`;

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are creating educational phishing simulations for cybersecurity training. Make them realistic but clearly for training purposes."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" }
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('No content received from OpenAI');
      }
      const emailData = JSON.parse(content);
      return emailData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Phishing email generation failed: ${errorMessage}`);
    }
  }
}

export const openaiService = new OpenAIService();
