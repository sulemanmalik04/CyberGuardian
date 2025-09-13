import { format } from 'date-fns';
import type { AnalyticsEvent, User, PlatformAnalytics, DepartmentAnalytics, AnalyticsSummary } from './api';

// Export analytics data as CSV
export function exportToCSV(data: any[], filename: string) {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);
  
  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Handle nested objects and arrays
        if (typeof value === 'object' && value !== null) {
          return JSON.stringify(value).replace(/"/g, '""');
        }
        // Escape quotes and wrap in quotes if contains comma
        const stringValue = String(value ?? '');
        return stringValue.includes(',') || stringValue.includes('"') 
          ? `"${stringValue.replace(/"/g, '""')}"` 
          : stringValue;
      }).join(',')
    )
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${format(new Date(), 'yyyy-MM-dd_HHmm')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// Export chart as image
export function exportChartAsImage(chartElement: HTMLElement, filename: string) {
  // Use html2canvas or similar library to capture chart
  // For now, we'll use the browser's built-in print functionality
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${filename}</title>
        <style>
          body { 
            margin: 0; 
            padding: 20px; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        ${chartElement.outerHTML}
      </body>
    </html>
  `);
  
  printWindow.document.close();
  printWindow.focus();
  
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 250);
}

// Generate PDF report (simplified version - in production, use a library like jsPDF)
export function generatePDFReport(
  title: string,
  data: {
    summary?: AnalyticsSummary;
    platformAnalytics?: PlatformAnalytics;
    departmentAnalytics?: DepartmentAnalytics[];
    events?: AnalyticsEvent[];
    users?: User[];
  }
) {
  // Create HTML content for PDF
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 40px;
            color: #333;
          }
          h1 { color: #111; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
          h2 { color: #3b82f6; margin-top: 30px; }
          h3 { color: #666; margin-top: 20px; }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 20px 0;
            font-size: 14px;
          }
          th, td { 
            padding: 12px; 
            text-align: left; 
            border-bottom: 1px solid #e5e7eb;
          }
          th { 
            background-color: #f9fafb; 
            font-weight: 600;
            color: #4b5563;
          }
          tr:hover { background-color: #f9fafb; }
          .metric-card {
            display: inline-block;
            padding: 15px 20px;
            margin: 10px;
            background: #f9fafb;
            border-radius: 8px;
            min-width: 150px;
          }
          .metric-value {
            font-size: 24px;
            font-weight: bold;
            color: #3b82f6;
          }
          .metric-label {
            font-size: 12px;
            color: #6b7280;
            margin-top: 5px;
          }
          .section {
            margin: 30px 0;
            page-break-inside: avoid;
          }
          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <p>Generated on ${format(new Date(), 'MMMM dd, yyyy HH:mm')}</p>
        
        ${data.summary ? `
          <div class="section">
            <h2>Executive Summary</h2>
            <div>
              <div class="metric-card">
                <div class="metric-value">${data.summary.users.total}</div>
                <div class="metric-label">Total Users</div>
              </div>
              <div class="metric-card">
                <div class="metric-value">${data.summary.users.active}</div>
                <div class="metric-label">Active Users</div>
              </div>
              <div class="metric-card">
                <div class="metric-value">${data.summary.training.completionRate}%</div>
                <div class="metric-label">Training Completion</div>
              </div>
              <div class="metric-card">
                <div class="metric-value">${data.summary.phishing.clickRate}%</div>
                <div class="metric-label">Phishing Click Rate</div>
              </div>
            </div>
          </div>
        ` : ''}
        
        ${data.platformAnalytics ? `
          <div class="section">
            <h2>Platform Analytics</h2>
            <div>
              <div class="metric-card">
                <div class="metric-value">${data.platformAnalytics.summary.totalClients}</div>
                <div class="metric-label">Total Clients</div>
              </div>
              <div class="metric-card">
                <div class="metric-value">${data.platformAnalytics.summary.totalUsers}</div>
                <div class="metric-label">Platform Users</div>
              </div>
              <div class="metric-card">
                <div class="metric-value">${data.platformAnalytics.summary.platformEngagementRate}%</div>
                <div class="metric-label">Engagement Rate</div>
              </div>
            </div>
            
            <h3>Client Performance</h3>
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Users</th>
                  <th>Active</th>
                  <th>Courses Completed</th>
                  <th>Phishing Success Rate</th>
                  <th>License Status</th>
                </tr>
              </thead>
              <tbody>
                ${data.platformAnalytics.clients.map(client => `
                  <tr>
                    <td>${client.clientName}</td>
                    <td>${client.totalUsers}</td>
                    <td>${client.activeUsers}</td>
                    <td>${client.completedCourses}</td>
                    <td>${((client.phishingReports / (client.phishingClicks + client.phishingReports)) * 100).toFixed(1)}%</td>
                    <td>${client.licenseStatus}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}
        
        ${data.departmentAnalytics && data.departmentAnalytics.length > 0 ? `
          <div class="section">
            <h2>Department Analytics</h2>
            <table>
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Total Users</th>
                  <th>Active Users</th>
                  <th>Completion Rate</th>
                  <th>Avg Quiz Score</th>
                  <th>Risk Score</th>
                </tr>
              </thead>
              <tbody>
                ${data.departmentAnalytics.map(dept => `
                  <tr>
                    <td>${dept.name}</td>
                    <td>${dept.totalUsers}</td>
                    <td>${dept.activeUsers}</td>
                    <td>${dept.completionRate}%</td>
                    <td>${dept.avgQuizScore}%</td>
                    <td>${dept.riskScore}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}
        
        ${data.users && data.users.length > 0 ? `
          <div class="section">
            <h2>User Report</h2>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Department</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last Login</th>
                </tr>
              </thead>
              <tbody>
                ${data.users.slice(0, 50).map(user => `
                  <tr>
                    <td>${user.firstName} ${user.lastName}</td>
                    <td>${user.email}</td>
                    <td>${user.department || 'N/A'}</td>
                    <td>${user.role}</td>
                    <td>${user.isActive ? 'Active' : 'Inactive'}</td>
                    <td>${user.lastLoginAt ? format(new Date(user.lastLoginAt), 'MM/dd/yyyy') : 'Never'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            ${data.users.length > 50 ? '<p><em>Showing first 50 users of ' + data.users.length + ' total</em></p>' : ''}
          </div>
        ` : ''}
        
        <div class="section">
          <p style="text-align: center; color: #9ca3af; margin-top: 50px;">
            © ${new Date().getFullYear()} Cybersecurity Awareness Platform - Confidential Report
          </p>
        </div>
      </body>
    </html>
  `;
  
  // Open in new window for printing/saving as PDF
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    console.error('Failed to open print window');
    return;
  }
  
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.focus();
  
  // Auto-trigger print dialog after content loads
  setTimeout(() => {
    printWindow.print();
  }, 500);
}

// Format data for activity feed
export function formatActivityFeedItem(event: AnalyticsEvent): string {
  const timestamp = format(new Date(event.timestamp), 'HH:mm');
  
  switch (event.eventType) {
    case 'login':
      return `User logged in at ${timestamp}`;
    case 'course_completed':
      return `Completed training course at ${timestamp}`;
    case 'quiz_completed':
      return `Completed quiz with score ${event.metadata?.score}% at ${timestamp}`;
    case 'email_opened':
      return `Opened phishing simulation email at ${timestamp}`;
    case 'email_clicked':
      return `Clicked link in phishing email at ${timestamp}`;
    case 'phishing_reported':
      return `Successfully reported phishing email at ${timestamp}`;
    default:
      return `${event.eventType} at ${timestamp}`;
  }
}

// Calculate risk score based on user behavior
export function calculateRiskScore(
  userEvents: AnalyticsEvent[],
  completedCourses: number,
  totalCourses: number
): number {
  let score = 100; // Start with perfect score
  
  // Deduct points for risky behavior
  const phishingClicks = userEvents.filter(e => e.eventType === 'email_clicked').length;
  const phishingReports = userEvents.filter(e => e.eventType === 'phishing_reported').length;
  const totalPhishing = phishingClicks + phishingReports;
  
  if (totalPhishing > 0) {
    const phishingScore = (phishingReports / totalPhishing) * 100;
    score = score * (phishingScore / 100);
  }
  
  // Factor in training completion
  if (totalCourses > 0) {
    const completionRate = (completedCourses / totalCourses) * 100;
    score = score * (completionRate / 100);
  }
  
  // Factor in recent activity
  const lastWeekEvents = userEvents.filter(e => 
    new Date(e.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  );
  
  if (lastWeekEvents.length === 0) {
    score = score * 0.9; // 10% penalty for inactivity
  }
  
  return Math.round(score);
}