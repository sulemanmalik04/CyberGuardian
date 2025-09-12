import { MailService } from '@sendgrid/mail';
import type { PhishingCampaign, User } from '@shared/schema';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const isDevelopment = process.env.NODE_ENV === 'development';

// In development, we'll simulate email sending if no API key is provided
let mailService: MailService | null = null;

if (SENDGRID_API_KEY) {
  mailService = new MailService();
  mailService.setApiKey(SENDGRID_API_KEY);
} else if (!isDevelopment) {
  throw new Error("SENDGRID_API_KEY environment variable must be set in production");
}

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
  trackingSettings?: {
    clickTracking: {
      enable: boolean;
    };
    openTracking: {
      enable: boolean;
    };
  };
}

interface CampaignResult {
  sent: number;
  failed: number;
  errors: string[];
}

class SendGridService {
  async sendEmail(params: EmailParams): Promise<boolean> {
    try {
      if (!mailService) {
        // In development without API key, simulate successful email sending
        console.log('📧 [DEV] Simulated email send:', {
          to: params.to,
          from: params.from,
          subject: params.subject,
          hasHtml: !!params.html,
          hasText: !!params.text
        });
        return true;
      }

      await mailService.send({
        to: params.to,
        from: params.from,
        subject: params.subject,
        text: params.text || '',
        html: params.html,
        trackingSettings: params.trackingSettings || {
          clickTracking: { enable: true },
          openTracking: { enable: true }
        }
      });
      return true;
    } catch (error) {
      console.error('SendGrid email error:', error);
      return false;
    }
  }

  async sendPhishingCampaign(campaign: PhishingCampaign, targetUsers: User[]): Promise<CampaignResult> {
    const result: CampaignResult = {
      sent: 0,
      failed: 0,
      errors: []
    };

    // Filter users based on target groups if specified
    let recipients = targetUsers;
    if (campaign.targetGroups && campaign.targetGroups.length > 0) {
      recipients = targetUsers.filter(user => 
        campaign.targetGroups!.includes(user.department || '') ||
        campaign.targetGroups!.includes(user.role) ||
        campaign.targetGroups!.includes('all')
      );
    }

    console.log(`📧 Starting phishing campaign: ${campaign.name} targeting ${recipients.length} users`);

    for (const user of recipients) {
      try {
        // Generate tracking URLs
        const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
        const trackingPixelUrl = `${baseUrl}/api/track/open/${campaign.id}/${user.id}`;
        const clickTrackingUrl = `${baseUrl}/api/track/click/${campaign.id}/${user.id}`;
        const reportPhishingUrl = `${baseUrl}/api/track/report/${campaign.id}/${user.id}`;

        // Personalize email content
        const personalizedSubject = this.personalizeContent(campaign.template.subject, user);
        let personalizedHtml = this.personalizeContent(campaign.template.htmlContent, user);
        const personalizedText = this.personalizeContent(campaign.template.textContent || '', user);

        // Inject tracking pixel into HTML content
        if (personalizedHtml) {
          // Add tracking pixel before closing body tag
          if (personalizedHtml.includes('</body>')) {
            personalizedHtml = personalizedHtml.replace(
              '</body>',
              `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" alt="" /></body>`
            );
          } else {
            // If no body tag, add it at the end
            personalizedHtml += `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" alt="" />`;
          }

          // Replace tracking URLs - handle multiple URL patterns
          personalizedHtml = personalizedHtml.replace(
            /href="{{trackingUrl}}"/g,
            `href="${clickTrackingUrl}"`
          );

          // Add phishing report link if template includes it
          personalizedHtml = personalizedHtml.replace(
            /href="{{reportPhishingUrl}}"/g,
            `href="${reportPhishingUrl}"`
          );

          // Add training disclaimer if not present
          if (!personalizedHtml.includes('training') && !personalizedHtml.includes('simulation')) {
            personalizedHtml += `<div style="font-size: 10px; color: #999; margin-top: 20px; padding: 10px; border-top: 1px solid #ddd;">
              This is a simulated phishing email for security awareness training purposes. 
              If you received this email, please report it to your IT security team.
            </div>`;
          }
        }

        // Prepare SendGrid email with custom tracking
        const emailParams: EmailParams = {
          to: user.email,
          from: `${campaign.template.fromName} <${campaign.template.fromEmail}>`,
          subject: personalizedSubject,
          html: personalizedHtml,
          text: personalizedText,
          trackingSettings: {
            clickTracking: { enable: false }, // We use our own click tracking
            openTracking: { enable: false }   // We use our own open tracking
          }
        };

        // Add custom headers for better tracking
        (emailParams as any).customArgs = {
          campaign_id: campaign.id,
          user_id: user.id,
          client_id: user.clientId || '',
          phishing_simulation: 'true'
        };

        const emailSent = await this.sendEmail(emailParams);

        if (emailSent) {
          result.sent++;
          console.log(`✅ Email sent to ${user.email}`);
        } else {
          result.failed++;
          result.errors.push(`Failed to send to ${user.email}`);
          console.log(`❌ Failed to send to ${user.email}`);
        }

        // Add progressive delay to avoid rate limiting (faster for first emails, slower later)
        const delay = Math.min(50 + (result.sent * 10), 500);
        await new Promise(resolve => setTimeout(resolve, delay));

      } catch (error) {
        result.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Error sending to ${user.email}: ${errorMessage}`);
        console.error(`❌ Error sending to ${user.email}:`, error);
      }
    }

    console.log(`📊 Campaign complete - Sent: ${result.sent}, Failed: ${result.failed}`);
    return result;
  }

  private personalizeContent(content: string, user: User): string {
    return content
      .replace(/{{firstName}}/g, user.firstName)
      .replace(/{{lastName}}/g, user.lastName) 
      .replace(/{{fullName}}/g, `${user.firstName} ${user.lastName}`)
      .replace(/{{email}}/g, user.email)
      .replace(/{{department}}/g, user.department || 'your department')
      .replace(/{{company}}/g, 'your organization');
  }

  async sendTrainingNotification(user: User, courseName: string, clientBranding?: any): Promise<boolean> {
    try {
      const fromEmail = clientBranding?.supportEmail || 'training@cyberaware.com';
      const companyName = clientBranding?.companyName || 'CyberAware Pro';
      
      const subject = `New Training Assignment: ${courseName}`;
      
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .header { background-color: ${clientBranding?.primaryColor || '#1e40af'}; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .cta { background-color: ${clientBranding?.accentColor || '#f97316'}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0; }
            .footer { background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${companyName}</h1>
            <h2>New Training Assignment</h2>
          </div>
          <div class="content">
            <p>Hello ${user.firstName},</p>
            <p>You have been assigned a new cybersecurity training course: <strong>${courseName}</strong></p>
            <p>Please complete this training within the next 7 days to maintain your security awareness certification.</p>
            <a href="${process.env.BASE_URL || 'http://localhost:5000'}/courses" class="cta">Start Training</a>
            <p>If you have any questions, please contact your training administrator.</p>
            <p>Best regards,<br>The Security Training Team</p>
          </div>
          <div class="footer">
            <p>${clientBranding?.emailFooter || '© 2024 CyberAware Pro. All rights reserved.'}</p>
          </div>
        </body>
        </html>
      `;

      const text = `
        Hello ${user.firstName},

        You have been assigned a new cybersecurity training course: ${courseName}

        Please complete this training within the next 7 days to maintain your security awareness certification.

        Visit ${process.env.BASE_URL || 'http://localhost:5000'}/courses to start your training.

        If you have any questions, please contact your training administrator.

        Best regards,
        The Security Training Team
      `;

      return await this.sendEmail({
        to: user.email,
        from: `${companyName} Training <${fromEmail}>`,
        subject,
        html,
        text
      });
    } catch (error) {
      console.error('Training notification error:', error);
      return false;
    }
  }

  async sendCertificateEmail(user: User, courseName: string, certificateUrl: string, clientBranding?: any): Promise<boolean> {
    try {
      const fromEmail = clientBranding?.supportEmail || 'training@cyberaware.com';
      const companyName = clientBranding?.companyName || 'CyberAware Pro';
      
      const subject = `Congratulations! Training Certificate - ${courseName}`;
      
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .header { background-color: ${clientBranding?.primaryColor || '#1e40af'}; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .certificate-link { background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0; }
            .footer { background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${companyName}</h1>
            <h2>🎉 Training Complete!</h2>
          </div>
          <div class="content">
            <p>Congratulations ${user.firstName}!</p>
            <p>You have successfully completed the <strong>${courseName}</strong> training course.</p>
            <p>Your certificate of completion is ready for download:</p>
            <a href="${certificateUrl}" class="certificate-link">Download Certificate</a>
            <p>Keep up the great work in maintaining strong cybersecurity practices!</p>
            <p>Best regards,<br>The Security Training Team</p>
          </div>
          <div class="footer">
            <p>${clientBranding?.emailFooter || '© 2024 CyberAware Pro. All rights reserved.'}</p>
          </div>
        </body>
        </html>
      `;

      return await this.sendEmail({
        to: user.email,
        from: `${companyName} Training <${fromEmail}>`,
        subject,
        html
      });
    } catch (error) {
      console.error('Certificate email error:', error);
      return false;
    }
  }
}

export const sendgridService = new SendGridService();
