import { MailService } from '@sendgrid/mail';
import type { PhishingCampaign, User } from '@shared/schema';

if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY environment variable must be set");
}

const mailService = new MailService();
mailService.setApiKey(process.env.SENDGRID_API_KEY);

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
      await mailService.send({
        to: params.to,
        from: params.from,
        subject: params.subject,
        text: params.text,
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
        campaign.targetGroups.includes(user.department || '') ||
        campaign.targetGroups.includes(user.role) ||
        campaign.targetGroups.includes('all')
      );
    }

    for (const user of recipients) {
      try {
        // Add tracking pixels and links to email content
        const trackingPixelUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/api/track/open/${campaign.id}/${user.id}`;
        const clickTrackingUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/api/track/click/${campaign.id}/${user.id}`;

        // Inject tracking pixel into HTML content
        let htmlContent = campaign.template.htmlContent;
        if (htmlContent) {
          // Add tracking pixel at the end of the body
          htmlContent = htmlContent.replace(
            '</body>',
            `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" /></body>`
          );

          // Replace any links with click tracking
          htmlContent = htmlContent.replace(
            /href="([^"]+)"/g,
            `href="${clickTrackingUrl}?redirect=$1"`
          );
        }

        // Personalize email content
        const personalizedSubject = campaign.template.subject
          .replace('{{firstName}}', user.firstName)
          .replace('{{lastName}}', user.lastName)
          .replace('{{email}}', user.email);

        const personalizedHtml = htmlContent
          .replace(/{{firstName}}/g, user.firstName)
          .replace(/{{lastName}}/g, user.lastName)
          .replace(/{{email}}/g, user.email);

        const personalizedText = campaign.template.textContent
          ?.replace(/{{firstName}}/g, user.firstName)
          .replace(/{{lastName}}/g, user.lastName)
          .replace(/{{email}}/g, user.email);

        const emailSent = await this.sendEmail({
          to: user.email,
          from: `${campaign.template.fromName} <${campaign.template.fromEmail}>`,
          subject: personalizedSubject,
          html: personalizedHtml,
          text: personalizedText,
          trackingSettings: {
            clickTracking: { enable: true },
            openTracking: { enable: true }
          }
        });

        if (emailSent) {
          result.sent++;
        } else {
          result.failed++;
          result.errors.push(`Failed to send to ${user.email}`);
        }

        // Add delay between emails to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        result.failed++;
        result.errors.push(`Error sending to ${user.email}: ${error.message}`);
      }
    }

    return result;
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
