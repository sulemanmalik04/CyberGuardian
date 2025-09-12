// Comprehensive phishing email templates for security awareness training
// These templates cover common attack vectors used by real attackers

export interface PhishingTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  fromName: string;
  fromEmail: string;
  suggestedDomain: string;
  riskLevel: 'low' | 'medium' | 'high';
  tags: string[];
}

export const phishingTemplates: PhishingTemplate[] = [
  {
    id: 'office365-login',
    name: 'Office 365 Login Required',
    category: 'Credential Harvesting',
    description: 'Fake Office 365 login notification requesting immediate action',
    subject: 'Your Office 365 account will be suspended',
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; }
          .header { background-color: #0078d4; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; }
          .button { background-color: #0078d4; color: white; padding: 12px 30px; text-decoration: none; border-radius: 3px; display: inline-block; margin: 20px 0; }
          .footer { background-color: #f8f8f8; padding: 20px; font-size: 12px; color: #666; }
          .warning { color: #d83b01; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Microsoft Office 365</h1>
          </div>
          <div class="content">
            <h2>Account Security Alert</h2>
            <p>Dear {{firstName}},</p>
            <p>We've detected unusual sign-in activity on your Office 365 account ({{email}}). To protect your account, we've temporarily limited access.</p>
            <p class="warning">Your account will be suspended in 24 hours unless you verify your credentials.</p>
            <p>Please click the button below to verify your account and restore full access:</p>
            <a href="{{trackingUrl}}" class="button">Verify My Account</a>
            <p>If you don't recognize this activity, please secure your account immediately.</p>
            <p>Thank you,<br>Microsoft Security Team</p>
          </div>
          <div class="footer">
            <p>This email was sent from a notification-only address. Please do not reply to this message.</p>
            <p>Microsoft Corporation, One Microsoft Way, Redmond, WA 98052</p>
          </div>
        </div>
      </body>
      </html>
    `,
    textContent: 'Your Office 365 account has been flagged for unusual activity. Please verify your credentials at {{trackingUrl}} to prevent suspension.',
    fromName: 'Microsoft Security',
    fromEmail: 'security@microsoft-alerts.com',
    suggestedDomain: 'microsoft-alerts.com',
    riskLevel: 'high',
    tags: ['credential-harvesting', 'office365', 'urgent', 'security-alert']
  },

  {
    id: 'banking-security',
    name: 'Bank Security Alert',
    category: 'Financial Fraud',
    description: 'Fake banking security alert requesting immediate verification',
    subject: 'Suspicious transaction detected - Immediate action required',
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; border: 1px solid #ddd; }
          .header { background-color: #004d9f; color: white; padding: 20px; }
          .content { padding: 30px; }
          .alert-box { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .button { background-color: #004d9f; color: white; padding: 12px 25px; text-decoration: none; border-radius: 4px; display: inline-block; }
          .transaction { background-color: #f8f9fa; padding: 15px; margin: 15px 0; border-left: 4px solid #dc3545; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>SecureBank</h1>
            <p>Your trusted financial partner</p>
          </div>
          <div class="content">
            <div class="alert-box">
              <strong>SECURITY ALERT:</strong> Suspicious activity detected on your account
            </div>
            <p>Dear {{firstName}} {{lastName}},</p>
            <p>We've detected a suspicious transaction on your account ending in ****2847:</p>
            <div class="transaction">
              <strong>Transaction Details:</strong><br>
              Amount: $1,247.99<br>
              Merchant: Online Purchase - AMZN MKTP<br>
              Date: Today, 11:32 AM<br>
              Location: Unknown
            </div>
            <p>If this transaction was not authorized by you, please verify your account immediately to prevent further unauthorized access.</p>
            <a href="{{trackingUrl}}" class="button">Verify Account Now</a>
            <p>For your security, this link will expire in 2 hours.</p>
            <p>Best regards,<br>SecureBank Security Team</p>
          </div>
        </div>
      </body>
      </html>
    `,
    textContent: 'SECURITY ALERT: Suspicious transaction of $1,247.99 detected. Verify your account at {{trackingUrl}} immediately.',
    fromName: 'SecureBank Security',
    fromEmail: 'security@securebank-alerts.com',
    suggestedDomain: 'securebank-alerts.com',
    riskLevel: 'high',
    tags: ['banking', 'financial-fraud', 'urgent', 'transaction-alert']
  },

  {
    id: 'ceo-fraud',
    name: 'CEO Urgent Request',
    category: 'Business Email Compromise',
    description: 'CEO impersonation requesting urgent wire transfer or sensitive information',
    subject: 'URGENT: Confidential Transaction Required',
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: white; }
          .content { max-width: 500px; margin: 0 auto; }
          .urgent { color: #d73027; font-weight: bold; }
          .signature { margin-top: 30px; border-top: 1px solid #ccc; padding-top: 15px; }
        </style>
      </head>
      <body>
        <div class="content">
          <p>{{firstName}},</p>
          <p>I hope this email finds you well. I'm currently in back-to-back meetings with potential investors, but I need your immediate assistance with a <span class="urgent">time-sensitive and confidential</span> transaction.</p>
          <p>We have an opportunity to acquire a strategic partner, but the deal must be finalized today. I need you to coordinate a wire transfer of $45,000 to secure this acquisition.</p>
          <p>Due to the confidential nature of this deal, please do not discuss this with anyone else in the office. I will provide the banking details once you confirm you can handle this.</p>
          <p>Please respond ASAP - the sellers are waiting for confirmation.</p>
          <p>This is our chance to get ahead of the competition.</p>
          <div class="signature">
            <p>Best regards,<br>
            <strong>Michael Thompson</strong><br>
            Chief Executive Officer<br>
            {{company}}<br>
            Mobile: +1 (555) 123-4567</p>
          </div>
        </div>
      </body>
      </html>
    `,
    textContent: '{{firstName}}, I need your urgent help with a confidential wire transfer of $45,000 for a strategic acquisition. Please respond immediately. - Michael Thompson, CEO',
    fromName: 'Michael Thompson',
    fromEmail: 'mthompson@company-exec.com',
    suggestedDomain: 'company-exec.com',
    riskLevel: 'high',
    tags: ['ceo-fraud', 'business-email-compromise', 'wire-transfer', 'urgent']
  },

  {
    id: 'google-drive-share',
    name: 'Google Drive Document Share',
    category: 'Credential Harvesting',
    description: 'Fake Google Drive document sharing notification',
    subject: '{{firstName}} shared "Annual Budget 2024.xlsx" with you',
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Google Sans', Arial, sans-serif; margin: 0; padding: 0; background-color: #f8f9fa; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; }
          .header { padding: 20px; border-bottom: 1px solid #dadce0; }
          .content { padding: 30px; }
          .file-preview { background-color: #f8f9fa; border: 1px solid #dadce0; padding: 20px; margin: 20px 0; border-radius: 8px; }
          .button { background-color: #1a73e8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; }
          .footer { background-color: #f8f9fa; padding: 20px; font-size: 12px; color: #5f6368; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" alt="Google Drive" style="height: 24px;">
            <span style="font-size: 20px; margin-left: 8px; color: #202124;">Google Drive</span>
          </div>
          <div class="content">
            <h2>A file has been shared with you</h2>
            <p>{{firstName}} ({{email}}) has shared a file with you on Google Drive.</p>
            <div class="file-preview">
              <div style="display: flex; align-items: center;">
                <div style="background-color: #0f9d58; width: 40px; height: 40px; border-radius: 4px; margin-right: 15px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">XL</div>
                <div>
                  <div style="font-weight: 500; font-size: 16px;">Annual Budget 2024.xlsx</div>
                  <div style="color: #5f6368; font-size: 14px;">Excel Spreadsheet • 2.3 MB</div>
                </div>
              </div>
            </div>
            <p>Click the button below to open the file:</p>
            <a href="{{trackingUrl}}" class="button">Open in Google Drive</a>
            <p style="margin-top: 30px; color: #5f6368; font-size: 14px;">
              You're receiving this email because {{email}} shared a file with you from Google Drive.
            </p>
          </div>
          <div class="footer">
            <p>Google LLC, 1600 Amphitheatre Parkway, Mountain View, CA 94043, USA</p>
          </div>
        </div>
      </body>
      </html>
    `,
    textContent: '{{firstName}} shared "Annual Budget 2024.xlsx" with you on Google Drive. Open it at: {{trackingUrl}}',
    fromName: 'Google Drive',
    fromEmail: 'drive-shares-noreply@googledrive.com',
    suggestedDomain: 'googledrive.com',
    riskLevel: 'medium',
    tags: ['google-drive', 'file-sharing', 'credential-harvesting', 'cloud-storage']
  },

  {
    id: 'paypal-payment',
    name: 'PayPal Payment Notification',
    category: 'Financial Fraud',
    description: 'Fake PayPal payment notification with suspicious transaction',
    subject: 'Payment of $299.99 sent from your PayPal account',
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f7f7f7; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; }
          .header { background-color: #0070ba; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; }
          .payment-box { background-color: #fff5f5; border: 1px solid #fed7d7; padding: 20px; margin: 20px 0; border-radius: 4px; }
          .amount { font-size: 24px; font-weight: bold; color: #e53e3e; }
          .button { background-color: #0070ba; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block; }
          .footer { background-color: #f7f7f7; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>PayPal</h1>
          </div>
          <div class="content">
            <h2>Payment Sent</h2>
            <p>Hello {{firstName}},</p>
            <p>A payment has been sent from your PayPal account.</p>
            <div class="payment-box">
              <div class="amount">-$299.99 USD</div>
              <p><strong>To:</strong> TechSupport Solutions Inc.</p>
              <p><strong>For:</strong> Remote Computer Assistance</p>
              <p><strong>Transaction ID:</strong> 7VJ479238P920731H</p>
              <p><strong>Date:</strong> Today at 2:15 PM</p>
            </div>
            <p>If you did not authorize this payment, please review the transaction details and contact us immediately.</p>
            <a href="{{trackingUrl}}" class="button">Review Transaction</a>
            <p>Questions? We're here to help. Contact PayPal customer service for assistance.</p>
            <p>PayPal</p>
          </div>
          <div class="footer">
            <p>PayPal Inc., 2211 North First Street, San Jose, CA 95131</p>
            <p>Please do not reply to this email. This mailbox is not monitored.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    textContent: 'A payment of $299.99 was sent from your PayPal account to TechSupport Solutions Inc. If unauthorized, review at: {{trackingUrl}}',
    fromName: 'PayPal',
    fromEmail: 'service@paypal-security.com',
    suggestedDomain: 'paypal-security.com',
    riskLevel: 'high',
    tags: ['paypal', 'payment-fraud', 'financial', 'unauthorized-payment']
  },

  {
    id: 'linkedin-connection',
    name: 'LinkedIn Connection Request',
    category: 'Social Engineering',
    description: 'Fake LinkedIn connection request to harvest credentials',
    subject: 'Sarah Johnson wants to connect with you',
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f3f2ef; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; }
          .header { background-color: #0a66c2; color: white; padding: 20px; }
          .content { padding: 30px; }
          .profile { display: flex; align-items: center; margin: 20px 0; padding: 20px; background-color: #f9f9f9; border-radius: 8px; }
          .avatar { width: 60px; height: 60px; border-radius: 50%; background-color: #0a66c2; margin-right: 15px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 20px; }
          .button { background-color: #0a66c2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 15px 5px; }
          .button-secondary { background-color: transparent; color: #0a66c2; border: 1px solid #0a66c2; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>LinkedIn</h1>
          </div>
          <div class="content">
            <h2>Invitation to connect</h2>
            <div class="profile">
              <div class="avatar">SJ</div>
              <div>
                <h3 style="margin: 0;">Sarah Johnson</h3>
                <p style="margin: 5px 0; color: #666;">Senior HR Director at Microsoft</p>
                <p style="margin: 5px 0; color: #666;">500+ connections</p>
              </div>
            </div>
            <p>Hi {{firstName}},</p>
            <p>I'd like to add you to my professional network on LinkedIn.</p>
            <p>I came across your profile and was impressed by your background in {{department}}. I think we could have some great conversations about industry trends and opportunities.</p>
            <a href="{{trackingUrl}}" class="button">Accept</a>
            <a href="{{trackingUrl}}" class="button button-secondary">View Profile</a>
            <p style="margin-top: 30px; color: #666; font-size: 14px;">
              You're receiving this email because Sarah Johnson invited you to join their network on LinkedIn.
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
    textContent: 'Sarah Johnson (Senior HR Director at Microsoft) wants to connect with you on LinkedIn. Accept the invitation: {{trackingUrl}}',
    fromName: 'LinkedIn',
    fromEmail: 'invitations@linkedin-connect.com',
    suggestedDomain: 'linkedin-connect.com',
    riskLevel: 'medium',
    tags: ['linkedin', 'social-engineering', 'networking', 'hr-impersonation']
  },

  {
    id: 'fedex-delivery',
    name: 'FedEx Delivery Notification',
    category: 'Package Scam',
    description: 'Fake FedEx delivery notification requiring immediate action',
    subject: 'FedEx Package Delivery Failed - Action Required',
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; }
          .header { background-color: #4d148c; color: white; padding: 20px; }
          .content { padding: 30px; }
          .package-info { background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-left: 4px solid #4d148c; }
          .button { background-color: #ff6600; color: white; padding: 12px 25px; text-decoration: none; border-radius: 4px; display: inline-block; }
          .warning { color: #d73027; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>FedEx</h1>
            <p>Delivery Notification</p>
          </div>
          <div class="content">
            <h2>Delivery Attempt Failed</h2>
            <p>Dear {{firstName}},</p>
            <p>We attempted to deliver your package today but were unable to complete the delivery. The package is currently being held at our local facility.</p>
            <div class="package-info">
              <p><strong>Tracking Number:</strong> 1234 5678 9012 3456</p>
              <p><strong>From:</strong> Amazon Fulfillment Center</p>
              <p><strong>Delivery Address:</strong> {{email}}</p>
              <p><strong>Package Value:</strong> $347.99</p>
              <p><strong>Attempted Delivery:</strong> Today, 11:45 AM</p>
            </div>
            <p class="warning">Important: Your package will be returned to sender if not claimed within 48 hours.</p>
            <p>To reschedule delivery or arrange pickup, please click the button below:</p>
            <a href="{{trackingUrl}}" class="button">Reschedule Delivery</a>
            <p>Thank you for choosing FedEx.</p>
            <p>FedEx Customer Service</p>
          </div>
        </div>
      </body>
      </html>
    `,
    textContent: 'FedEx delivery failed for package 1234 5678 9012 3456. Reschedule delivery at {{trackingUrl}} within 48 hours to avoid return to sender.',
    fromName: 'FedEx Delivery',
    fromEmail: 'delivery@fedex-notifications.com',
    suggestedDomain: 'fedex-notifications.com',
    riskLevel: 'medium',
    tags: ['fedex', 'package-delivery', 'shipping', 'failed-delivery']
  },

  {
    id: 'it-password-expiry',
    name: 'IT Password Expiration',
    category: 'IT Impersonation',
    description: 'Fake IT department notification about password expiration',
    subject: 'Password expires in 24 hours - Action required',
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f8f9fa; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; border: 1px solid #dee2e6; }
          .header { background-color: #343a40; color: white; padding: 20px; }
          .content { padding: 30px; }
          .alert-box { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .button { background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 4px; display: inline-block; }
          .footer { background-color: #f8f9fa; padding: 20px; font-size: 12px; color: #6c757d; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>IT Department</h1>
            <p>Information Technology Services</p>
          </div>
          <div class="content">
            <div class="alert-box">
              <strong>⚠️ Password Expiration Notice</strong>
            </div>
            <p>Dear {{firstName}},</p>
            <p>This is an automated reminder that your network password will expire in <strong>24 hours</strong>.</p>
            <p>To maintain uninterrupted access to company systems, email, and applications, you must update your password before it expires.</p>
            <p><strong>Account Details:</strong></p>
            <ul>
              <li>Username: {{email}}</li>
              <li>Department: {{department}}</li>
              <li>Expiration: Tomorrow at 11:59 PM</li>
            </ul>
            <p>Click the button below to update your password now:</p>
            <a href="{{trackingUrl}}" class="button">Update Password</a>
            <p><strong>Important:</strong> If your password expires, you will be locked out of all systems until IT support can assist you.</p>
            <p>If you have any questions, please contact the IT Help Desk at (555) 123-4567.</p>
            <p>IT Support Team<br>{{company}}</p>
          </div>
          <div class="footer">
            <p>This is an automated message from the IT Department. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    textContent: 'Your password expires in 24 hours. Update it now at {{trackingUrl}} to maintain access to company systems.',
    fromName: 'IT Support',
    fromEmail: 'it-support@company-systems.com',
    suggestedDomain: 'company-systems.com',
    riskLevel: 'high',
    tags: ['it-support', 'password-expiry', 'system-access', 'urgent']
  },

  {
    id: 'security-software-update',
    name: 'Security Software Update',
    category: 'Malware Distribution',
    description: 'Fake security software update notification',
    subject: 'Critical Security Update Required - Download Now',
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; }
          .header { background-color: #d73027; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; }
          .critical-alert { background-color: #ffe6e6; border: 2px solid #d73027; padding: 20px; margin: 20px 0; border-radius: 4px; text-align: center; }
          .button { background-color: #d73027; color: white; padding: 15px 30px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold; }
          .features { background-color: #f8f9fa; padding: 20px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🛡️ Windows Security</h1>
            <p>Critical Security Update Available</p>
          </div>
          <div class="content">
            <div class="critical-alert">
              <h2 style="color: #d73027; margin: 0;">CRITICAL VULNERABILITIES DETECTED</h2>
              <p style="margin: 10px 0;">Your system is at risk. Immediate action required.</p>
            </div>
            <p>Dear {{firstName}},</p>
            <p>Our security scan has detected <strong>17 critical vulnerabilities</strong> on your computer that could allow hackers to steal your personal information.</p>
            <div class="features">
              <h3>Threats Detected:</h3>
              <ul>
                <li>Trojan.Win32.Agent.pdb</li>
                <li>Backdoor.Generic.4829</li>
                <li>Rootkit.Boot.Cidox.b</li>
                <li>Spyware.Passwords.XGen</li>
              </ul>
            </div>
            <p>Download our latest security patch to protect your system immediately:</p>
            <a href="{{trackingUrl}}" class="button">Download Security Update</a>
            <p style="color: #d73027; font-weight: bold;">Warning: Delaying this update may result in data loss or identity theft.</p>
            <p>Windows Security Team</p>
          </div>
        </div>
      </body>
      </html>
    `,
    textContent: 'CRITICAL: 17 security vulnerabilities detected on your computer. Download immediate security patch: {{trackingUrl}}',
    fromName: 'Windows Security',
    fromEmail: 'security@windows-updates.net',
    suggestedDomain: 'windows-updates.net',
    riskLevel: 'high',
    tags: ['malware', 'security-software', 'fake-update', 'windows']
  },

  {
    id: 'tax-refund',
    name: 'Tax Refund Notification',
    category: 'Government Impersonation',
    description: 'Fake IRS tax refund notification',
    subject: 'IRS Tax Refund Approval - $2,847.63 pending',
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f7f7f7; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; border: 1px solid #ddd; }
          .header { background-color: #003366; color: white; padding: 20px; }
          .content { padding: 30px; }
          .refund-box { background-color: #e8f5e8; border: 1px solid #4caf50; padding: 20px; margin: 20px 0; border-radius: 4px; text-align: center; }
          .amount { font-size: 28px; font-weight: bold; color: #2e7d32; }
          .button { background-color: #003366; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block; }
          .footer { background-color: #f7f7f7; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Internal Revenue Service</h1>
            <p>United States Treasury Department</p>
          </div>
          <div class="content">
            <h2>Tax Refund Approved</h2>
            <p>Dear {{firstName}} {{lastName}},</p>
            <p>After reviewing your 2023 tax return, we have determined that you are eligible for a tax refund.</p>
            <div class="refund-box">
              <p style="margin: 0; font-size: 16px;">Your approved refund amount:</p>
              <div class="amount">$2,847.63</div>
            </div>
            <p><strong>Refund Details:</strong></p>
            <ul>
              <li>Tax Year: 2023</li>
              <li>Taxpayer ID: {{email}}</li>
              <li>Processing Date: Today</li>
              <li>Refund Method: Direct Deposit</li>
            </ul>
            <p>To process your refund, please verify your banking information by clicking the button below:</p>
            <a href="{{trackingUrl}}" class="button">Claim Your Refund</a>
            <p><strong>Important:</strong> You must claim your refund within 72 hours or it will be forfeited.</p>
            <p>Internal Revenue Service<br>Tax Processing Division</p>
          </div>
          <div class="footer">
            <p>Internal Revenue Service, U.S. Treasury Department</p>
            <p>This is an official government communication.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    textContent: 'IRS Tax Refund Approved: $2,847.63. Claim your refund within 72 hours: {{trackingUrl}}',
    fromName: 'IRS Tax Processing',
    fromEmail: 'refunds@irs-treasury.gov',
    suggestedDomain: 'irs-treasury.gov',
    riskLevel: 'high',
    tags: ['irs', 'tax-refund', 'government', 'financial']
  },

  {
    id: 'amazon-order',
    name: 'Amazon Order Confirmation',
    category: 'E-commerce Fraud',
    description: 'Fake Amazon order confirmation for expensive item',
    subject: 'Your Amazon order has been shipped - $1,299.99',
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f3f3f3; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; }
          .header { background-color: #232f3e; color: white; padding: 20px; }
          .content { padding: 30px; }
          .order-box { border: 1px solid #ddd; padding: 20px; margin: 20px 0; }
          .product { display: flex; margin: 15px 0; }
          .product-info { margin-left: 15px; flex: 1; }
          .price { font-weight: bold; color: #b12704; font-size: 18px; }
          .button { background-color: #ff9900; color: #111; padding: 12px 25px; text-decoration: none; border-radius: 4px; display: inline-block; }
          .footer { background-color: #f3f3f3; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>amazon</h1>
          </div>
          <div class="content">
            <h2>Your order has been shipped</h2>
            <p>Hello {{firstName}},</p>
            <p>Your Amazon order has been shipped and is on its way!</p>
            <div class="order-box">
              <p><strong>Order #:</strong> 123-4567890-1234567</p>
              <p><strong>Shipped on:</strong> Today</p>
              <div class="product">
                <div style="width: 60px; height: 60px; background-color: #f0f0f0; border: 1px solid #ddd;"></div>
                <div class="product-info">
                  <h3 style="margin: 0;">MacBook Pro 16-inch M3 Max</h3>
                  <p style="margin: 5px 0; color: #666;">Apple | Space Black</p>
                  <div class="price">$1,299.99</div>
                </div>
              </div>
              <p><strong>Shipping Address:</strong><br>
              {{firstName}} {{lastName}}<br>
              (Address associated with {{email}})</p>
              <p><strong>Estimated Delivery:</strong> Tomorrow by 8 PM</p>
            </div>
            <p>If you did not place this order, please review your account immediately:</p>
            <a href="{{trackingUrl}}" class="button">Review Order</a>
            <p>Track your package or manage your order in Your Account.</p>
            <p>Thanks for shopping with us!</p>
            <p>Amazon Customer Service</p>
          </div>
          <div class="footer">
            <p>Amazon.com, Inc., 410 Terry Avenue North, Seattle, WA 98109-5210</p>
          </div>
        </div>
      </body>
      </html>
    `,
    textContent: 'Your Amazon order #123-4567890-1234567 for MacBook Pro ($1,299.99) has shipped. If you did not place this order, review at: {{trackingUrl}}',
    fromName: 'Amazon',
    fromEmail: 'auto-confirm@amazon-orders.com',
    suggestedDomain: 'amazon-orders.com',
    riskLevel: 'medium',
    tags: ['amazon', 'e-commerce', 'order-confirmation', 'expensive-item']
  },

  {
    id: 'voicemail-notification',
    name: 'Voicemail Notification',
    category: 'Communication Fraud',
    description: 'Fake voicemail notification requiring immediate attention',
    subject: 'New Voicemail from +1 (555) 123-4567',
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; border: 1px solid #ddd; }
          .header { background-color: #1f4e79; color: white; padding: 20px; }
          .content { padding: 30px; }
          .voicemail-box { background-color: #f8f9fa; border: 1px solid #dee2e6; padding: 20px; margin: 20px 0; border-radius: 4px; }
          .button { background-color: #28a745; color: white; padding: 12px 25px; text-decoration: none; border-radius: 4px; display: inline-block; }
          .urgent { color: #dc3545; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📞 Voicemail System</h1>
          </div>
          <div class="content">
            <h2>New Voicemail Message</h2>
            <p>Hello {{firstName}},</p>
            <p>You have received a new voicemail message.</p>
            <div class="voicemail-box">
              <p><strong>From:</strong> +1 (555) 123-4567</p>
              <p><strong>Date:</strong> Today at 3:42 PM</p>
              <p><strong>Duration:</strong> 1 minute 23 seconds</p>
              <p><strong>Priority:</strong> <span class="urgent">URGENT</span></p>
              <p><strong>Caller ID:</strong> Legal Department</p>
            </div>
            <p class="urgent">This message is marked as urgent and requires immediate attention.</p>
            <p>Click the button below to listen to your voicemail:</p>
            <a href="{{trackingUrl}}" class="button">🎵 Play Voicemail</a>
            <p>If you're unable to listen to the message, you can also access it by calling the voicemail system directly.</p>
            <p>Best regards,<br>Voicemail System</p>
          </div>
        </div>
      </body>
      </html>
    `,
    textContent: 'New URGENT voicemail from +1 (555) 123-4567 (Legal Department). Listen now: {{trackingUrl}}',
    fromName: 'Voicemail System',
    fromEmail: 'voicemail@company-communications.com',
    suggestedDomain: 'company-communications.com',
    riskLevel: 'medium',
    tags: ['voicemail', 'urgent', 'legal-department', 'phone-fraud']
  },

  {
    id: 'hr-policy-update',
    name: 'HR Policy Update',
    category: 'HR Impersonation',
    description: 'Fake HR policy update requiring acknowledgment',
    subject: 'Mandatory: New Employee Handbook - Immediate Acknowledgment Required',
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f8f9fa; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; border: 1px solid #dee2e6; }
          .header { background-color: #6f42c1; color: white; padding: 20px; }
          .content { padding: 30px; }
          .policy-box { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .button { background-color: #6f42c1; color: white; padding: 12px 25px; text-decoration: none; border-radius: 4px; display: inline-block; }
          .deadline { color: #dc3545; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Human Resources</h1>
            <p>{{company}} - Employee Relations</p>
          </div>
          <div class="content">
            <h2>Updated Employee Handbook</h2>
            <p>Dear {{firstName}},</p>
            <p>As part of our ongoing commitment to maintaining a compliant and safe workplace, we have updated our Employee Handbook with new policies effective immediately.</p>
            <div class="policy-box">
              <strong>New Policies Include:</strong>
              <ul>
                <li>Remote Work Guidelines</li>
                <li>Updated Security Protocols</li>
                <li>Social Media Usage Policy</li>
                <li>Confidentiality Agreements</li>
              </ul>
            </div>
            <p>All employees are required to review and acknowledge receipt of the updated handbook.</p>
            <p class="deadline">DEADLINE: You must complete your acknowledgment by end of business today to remain in compliance with company policy.</p>
            <p>Click the button below to access the handbook and complete your acknowledgment:</p>
            <a href="{{trackingUrl}}" class="button">Review & Acknowledge</a>
            <p>Failure to complete this acknowledgment may result in temporary suspension of system access until compliance is achieved.</p>
            <p>If you have any questions, please contact HR at hr@company.com or (555) 123-4567.</p>
            <p>Best regards,<br>
            Human Resources Department<br>
            {{company}}</p>
          </div>
        </div>
      </body>
      </html>
    `,
    textContent: 'MANDATORY: New Employee Handbook requires immediate acknowledgment. Complete by end of day: {{trackingUrl}}',
    fromName: 'HR Department',
    fromEmail: 'hr@company-policies.com',
    suggestedDomain: 'company-policies.com',
    riskLevel: 'medium',
    tags: ['hr', 'policy-update', 'mandatory', 'compliance']
  },

  {
    id: 'webex-meeting',
    name: 'WebEx Meeting Invitation',
    category: 'Business Impersonation',
    description: 'Fake WebEx meeting invitation with malicious link',
    subject: 'WebEx Meeting Invitation: Quarterly Budget Review',
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; }
          .header { background-color: #0056d2; color: white; padding: 20px; }
          .content { padding: 30px; }
          .meeting-box { border: 1px solid #ddd; padding: 20px; margin: 20px 0; background-color: #f8f9fa; }
          .button { background-color: #0056d2; color: white; padding: 12px 25px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold; }
          .urgent { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; margin: 15px 0; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Cisco WebEx</h1>
          </div>
          <div class="content">
            <h2>You're invited to a WebEx meeting</h2>
            <p>Hello {{firstName}},</p>
            <p>Michael Thompson has invited you to join a WebEx meeting.</p>
            <div class="meeting-box">
              <h3>Quarterly Budget Review</h3>
              <p><strong>When:</strong> Today at 4:00 PM EST</p>
              <p><strong>Duration:</strong> 1 hour</p>
              <p><strong>Host:</strong> Michael Thompson (CEO)</p>
              <p><strong>Meeting Number:</strong> 2596 847 3921</p>
              <p><strong>Password:</strong> Budget2024</p>
            </div>
            <div class="urgent">
              <strong>⚠️ Meeting starts in 30 minutes</strong> - Please join early to test your audio/video
            </div>
            <p>As a department head, your attendance is mandatory for this quarterly budget review. We'll be discussing budget allocations for Q2 and your input is crucial.</p>
            <a href="{{trackingUrl}}" class="button">Join WebEx Meeting</a>
            <p>If you're unable to attend, please notify Michael Thompson immediately as this meeting cannot be rescheduled.</p>
            <p>Best regards,<br>WebEx Meeting Service</p>
          </div>
        </div>
      </body>
      </html>
    `,
    textContent: 'WebEx Meeting Invitation: Quarterly Budget Review with CEO Michael Thompson today at 4:00 PM. Join: {{trackingUrl}}',
    fromName: 'WebEx Meeting',
    fromEmail: 'meetings@webex-invites.com',
    suggestedDomain: 'webex-invites.com',
    riskLevel: 'medium',
    tags: ['webex', 'meeting-invitation', 'ceo', 'urgent-meeting']
  }
];

export function getTemplateById(id: string): PhishingTemplate | undefined {
  return phishingTemplates.find(template => template.id === id);
}

export function getTemplatesByCategory(category: string): PhishingTemplate[] {
  return phishingTemplates.filter(template => template.category === category);
}

export function getTemplatesByRiskLevel(riskLevel: 'low' | 'medium' | 'high'): PhishingTemplate[] {
  return phishingTemplates.filter(template => template.riskLevel === riskLevel);
}

export function getAllTemplateCategories(): string[] {
  return Array.from(new Set(phishingTemplates.map(template => template.category)));
}