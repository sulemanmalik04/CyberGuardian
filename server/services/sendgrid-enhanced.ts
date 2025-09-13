import { MailService } from '@sendgrid/mail';
import type { PhishingCampaign, User } from '@shared/schema';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const isDevelopment = process.env.NODE_ENV === 'development';

// Initialize SendGrid service
let mailService: MailService | null = null;

if (SENDGRID_API_KEY) {
  mailService = new MailService();
  mailService.setApiKey(SENDGRID_API_KEY);
} else if (!isDevelopment) {
  throw new Error("SENDGRID_API_KEY environment variable must be set in production");
}

interface EmailParams {
  to: string | string[];
  from: string;
  subject: string;
  text?: string;
  html?: string;
  bcc?: string[];
  replyTo?: string;
  categories?: string[];
  customArgs?: Record<string, string>;
  trackingSettings?: {
    clickTracking: { enable: boolean };
    openTracking: { enable: boolean };
    subscriptionTracking?: { enable: boolean };
  };
  mailSettings?: {
    sandboxMode?: { enable: boolean };
  };
}

interface BatchEmailParams {
  personalizations: Array<{
    to: string;
    subject: string;
    substitutions?: Record<string, string>;
    customArgs?: Record<string, string>;
  }>;
  from: string;
  html: string;
  text?: string;
  categories?: string[];
  trackingSettings?: EmailParams['trackingSettings'];
}

interface CampaignResult {
  sent: number;
  failed: number;
  errors: string[];
  details: Array<{
    email: string;
    status: 'sent' | 'failed';
    error?: string;
    messageId?: string;
  }>;
}

class EnhancedSendGridService {
  private readonly BATCH_SIZE = 100; // SendGrid allows up to 1000 personalizations per request
  private readonly RATE_LIMIT_DELAY = 100; // Milliseconds between batches
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // Milliseconds

  // Email validation regex
  private readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /**
   * Validate email address format
   */
  private validateEmail(email: string): boolean {
    return this.EMAIL_REGEX.test(email);
  }

  /**
   * Send a single email with retry logic
   */
  async sendEmail(params: EmailParams, retryCount = 0): Promise<boolean> {
    try {
      // Validate email addresses
      const toEmails = Array.isArray(params.to) ? params.to : [params.to];
      for (const email of toEmails) {
        if (!this.validateEmail(email)) {
          console.error(`Invalid email address: ${email}`);
          return false;
        }
      }

      if (!mailService) {
        // In development without API key, simulate successful email sending
        console.log('📧 [DEV] Simulated email send:', {
          to: params.to,
          from: params.from,
          subject: params.subject,
          hasHtml: !!params.html,
          hasText: !!params.text,
          customArgs: params.customArgs
        });
        return true;
      }

      const response = await mailService.send({
        to: params.to,
        from: params.from,
        subject: params.subject,
        text: params.text || '',
        html: params.html,
        bcc: params.bcc,
        replyTo: params.replyTo,
        categories: params.categories,
        customArgs: params.customArgs,
        trackingSettings: params.trackingSettings || {
          clickTracking: { enable: true },
          openTracking: { enable: true }
        },
        mailSettings: params.mailSettings
      });

      console.log(`✅ Email sent successfully to ${params.to}`);
      return true;
    } catch (error: any) {
      console.error(`SendGrid email error (attempt ${retryCount + 1}):`, error);
      
      // Retry logic for transient errors
      if (retryCount < this.MAX_RETRIES && this.isRetryableError(error)) {
        console.log(`Retrying email send to ${params.to} after delay...`);
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * (retryCount + 1)));
        return this.sendEmail(params, retryCount + 1);
      }
      
      return false;
    }
  }

  /**
   * Send emails in batches for better performance
   */
  async sendBatchEmails(batch: BatchEmailParams): Promise<CampaignResult> {
    const result: CampaignResult = {
      sent: 0,
      failed: 0,
      errors: [],
      details: []
    };

    if (!mailService) {
      // Simulate batch sending in development
      console.log('📧 [DEV] Simulated batch email send:', {
        recipients: batch.personalizations.length,
        from: batch.from
      });
      
      batch.personalizations.forEach(p => {
        result.sent++;
        result.details.push({
          email: p.to,
          status: 'sent',
          messageId: `dev-${Date.now()}-${Math.random()}`
        });
      });
      
      return result;
    }

    try {
      // Prepare the batch email
      const message = {
        personalizations: batch.personalizations.map(p => ({
          to: [{ email: p.to }],
          subject: p.subject,
          substitutions: p.substitutions,
          customArgs: p.customArgs
        })),
        from: { email: batch.from },
        content: [
          { type: 'text/plain', value: batch.text || '' },
          { type: 'text/html', value: batch.html }
        ],
        categories: batch.categories,
        trackingSettings: batch.trackingSettings || {
          clickTracking: { enable: false },
          openTracking: { enable: false }
        }
      };

      const response = await mailService.send(message);
      
      // All emails in batch were sent successfully
      batch.personalizations.forEach(p => {
        result.sent++;
        result.details.push({
          email: p.to,
          status: 'sent',
          messageId: response[0].headers['x-message-id']
        });
      });

      console.log(`✅ Batch of ${batch.personalizations.length} emails sent successfully`);
    } catch (error: any) {
      console.error('Batch email error:', error);
      
      // Log which emails failed
      batch.personalizations.forEach(p => {
        result.failed++;
        result.details.push({
          email: p.to,
          status: 'failed',
          error: error.message
        });
      });
      
      result.errors.push(`Batch send failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Enhanced phishing campaign sender with batch processing
   */
  async sendPhishingCampaign(campaign: PhishingCampaign, targetUsers: User[]): Promise<CampaignResult> {
    const result: CampaignResult = {
      sent: 0,
      failed: 0,
      errors: [],
      details: []
    };

    // Filter and validate recipients
    let recipients = this.filterTargetUsers(campaign, targetUsers);
    recipients = recipients.filter(user => {
      if (!this.validateEmail(user.email)) {
        result.failed++;
        result.errors.push(`Invalid email: ${user.email}`);
        result.details.push({
          email: user.email,
          status: 'failed',
          error: 'Invalid email format'
        });
        return false;
      }
      return true;
    });

    console.log(`📧 Starting phishing campaign: ${campaign.name} targeting ${recipients.length} valid users`);

    // Process recipients in batches
    const batches = this.createBatches(recipients, this.BATCH_SIZE);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} recipients)`);
      
      // Prepare batch email
      const batchParams = this.prepareBatchEmail(campaign, batch);
      
      // Send batch
      const batchResult = await this.sendBatchEmails(batchParams);
      
      // Aggregate results
      result.sent += batchResult.sent;
      result.failed += batchResult.failed;
      result.errors.push(...batchResult.errors);
      result.details.push(...batchResult.details);
      
      // Rate limiting between batches
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, this.RATE_LIMIT_DELAY));
      }
    }

    console.log(`📊 Campaign complete - Sent: ${result.sent}, Failed: ${result.failed}`);
    return result;
  }

  /**
   * Filter users based on campaign target groups
   */
  private filterTargetUsers(campaign: PhishingCampaign, users: User[]): User[] {
    if (!campaign.targetGroups || campaign.targetGroups.length === 0) {
      return users;
    }

    if (campaign.targetGroups.includes('all')) {
      return users;
    }

    return users.filter(user => 
      campaign.targetGroups!.includes(user.department || '') ||
      campaign.targetGroups!.includes(user.role)
    );
  }

  /**
   * Create batches of users for batch processing
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Prepare batch email for phishing campaign
   */
  private prepareBatchEmail(campaign: PhishingCampaign, users: User[]): BatchEmailParams {
    const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
    
    // Prepare base HTML with tracking pixel placeholder
    let baseHtml = campaign.template.htmlContent || '';
    
    // Add training disclaimer if not present
    if (!baseHtml.includes('training') && !baseHtml.includes('simulation')) {
      baseHtml += `
        <div style="font-size: 10px; color: #999; margin-top: 20px; padding: 10px; border-top: 1px solid #ddd;">
          This is a simulated phishing email for security awareness training purposes. 
          If you received this email, please report it to your IT security team.
        </div>`;
    }

    // Create personalizations for each user
    const personalizations = users.map(user => {
      const trackingPixelUrl = `${baseUrl}/api/track/open/${campaign.id}/${user.id}`;
      const clickTrackingUrl = `${baseUrl}/api/track/click/${campaign.id}/${user.id}`;
      const reportPhishingUrl = `${baseUrl}/api/track/report/${campaign.id}/${user.id}`;

      // Personalize content
      const personalizedSubject = this.personalizeContent(campaign.template.subject, user);
      
      // Prepare HTML with tracking
      let personalizedHtml = this.personalizeContent(baseHtml, user);
      
      // Inject tracking pixel
      if (personalizedHtml.includes('</body>')) {
        personalizedHtml = personalizedHtml.replace(
          '</body>',
          `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" alt="" /></body>`
        );
      } else {
        personalizedHtml += `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" alt="" />`;
      }

      // Replace tracking URLs
      personalizedHtml = personalizedHtml
        .replace(/{{trackingUrl}}/g, clickTrackingUrl)
        .replace(/{{reportPhishingUrl}}/g, reportPhishingUrl);

      return {
        to: user.email,
        subject: personalizedSubject,
        customArgs: {
          campaign_id: campaign.id,
          user_id: user.id,
          client_id: user.clientId || '',
          phishing_simulation: 'true'
        }
      };
    });

    return {
      personalizations,
      from: `${campaign.template.fromName} <${campaign.template.fromEmail}>`,
      html: baseHtml,
      text: campaign.template.textContent || '',
      categories: ['phishing-simulation', campaign.name],
      trackingSettings: {
        clickTracking: { enable: false }, // We use our own tracking
        openTracking: { enable: false }   // We use our own tracking
      }
    };
  }

  /**
   * Personalize content with user variables
   */
  private personalizeContent(content: string, user: User): string {
    const currentDate = new Date().toLocaleDateString();
    return content
      .replace(/{{firstName}}/g, user.firstName)
      .replace(/{{lastName}}/g, user.lastName)
      .replace(/{{fullName}}/g, `${user.firstName} ${user.lastName}`)
      .replace(/{{email}}/g, user.email)
      .replace(/{{department}}/g, user.department || 'your department')
      .replace(/{{company}}/g, 'your organization')
      .replace(/{{currentDate}}/g, currentDate);
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (!error.code) return false;
    
    // Retry on rate limiting or temporary network errors
    const retryableCodes = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'RATE_LIMIT_EXCEEDED',
      '429', // Too Many Requests
      '503', // Service Unavailable
      '504'  // Gateway Timeout
    ];
    
    return retryableCodes.includes(error.code) || 
           (error.response && [429, 503, 504].includes(error.response.status));
  }

  /**
   * Send test email for campaign preview
   */
  async sendTestEmail(campaign: PhishingCampaign, testEmail: string): Promise<boolean> {
    if (!this.validateEmail(testEmail)) {
      console.error(`Invalid test email: ${testEmail}`);
      return false;
    }

    const testUser: User = {
      id: 'test-user',
      email: testEmail,
      firstName: 'Test',
      lastName: 'User',
      passwordHash: '',
      role: 'end_user',
      language: 'en',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
    const personalizedSubject = `[TEST] ${this.personalizeContent(campaign.template.subject, testUser)}`;
    let personalizedHtml = this.personalizeContent(campaign.template.htmlContent, testUser);
    
    // Add test banner
    personalizedHtml = `
      <div style="background: #ff0000; color: white; padding: 10px; text-align: center; font-weight: bold;">
        ⚠️ THIS IS A TEST EMAIL - DO NOT CLICK ANY LINKS ⚠️
      </div>
      ${personalizedHtml}
      <div style="background: #ff0000; color: white; padding: 10px; text-align: center; font-weight: bold; margin-top: 20px;">
        ⚠️ TEST EMAIL ONLY - NOT A REAL PHISHING SIMULATION ⚠️
      </div>
    `;

    // Replace tracking URLs with test indicators
    personalizedHtml = personalizedHtml
      .replace(/{{trackingUrl}}/g, `${baseUrl}/test-phishing-link`)
      .replace(/{{reportPhishingUrl}}/g, `${baseUrl}/test-report-link`);

    return await this.sendEmail({
      to: testEmail,
      from: `TEST - ${campaign.template.fromName} <noreply@cyberaware.com>`,
      subject: personalizedSubject,
      html: personalizedHtml,
      text: this.personalizeContent(campaign.template.textContent || '', testUser),
      categories: ['test-email', 'phishing-simulation'],
      trackingSettings: {
        clickTracking: { enable: false },
        openTracking: { enable: false }
      },
      mailSettings: isDevelopment ? { sandboxMode: { enable: true } } : undefined
    });
  }

  /**
   * Send campaign status report
   */
  async sendCampaignReport(campaign: PhishingCampaign, adminEmail: string, stats: any): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .header { background: #1e40af; color: white; padding: 20px; }
          .content { padding: 20px; }
          .stats { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .stat-item { display: inline-block; margin: 10px 20px; }
          .stat-value { font-size: 24px; font-weight: bold; color: #1e40af; }
          .stat-label { color: #666; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { padding: 10px; border: 1px solid #ddd; text-align: left; }
          th { background: #f5f5f5; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Phishing Campaign Report</h1>
          <h2>${campaign.name}</h2>
        </div>
        <div class="content">
          <div class="stats">
            <div class="stat-item">
              <div class="stat-value">${stats.emailsSent}</div>
              <div class="stat-label">Emails Sent</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${stats.openRate}%</div>
              <div class="stat-label">Open Rate</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${stats.clickRate}%</div>
              <div class="stat-label">Click Rate</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${stats.reportRate}%</div>
              <div class="stat-label">Report Rate</div>
            </div>
          </div>
          
          <h3>Campaign Details</h3>
          <table>
            <tr><th>Status</th><td>${campaign.status}</td></tr>
            <tr><th>Target Groups</th><td>${campaign.targetGroups.join(', ')}</td></tr>
            <tr><th>Template</th><td>${campaign.template.subject}</td></tr>
            <tr><th>Created</th><td>${new Date(campaign.createdAt).toLocaleDateString()}</td></tr>
          </table>
          
          <p>View detailed analytics and user reports in the dashboard.</p>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: adminEmail,
      from: 'CyberAware Reports <reports@cyberaware.com>',
      subject: `Campaign Report: ${campaign.name}`,
      html,
      categories: ['campaign-report']
    });
  }
}

export const enhancedSendGridService = new EnhancedSendGridService();