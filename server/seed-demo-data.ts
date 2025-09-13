#!/usr/bin/env tsx
import { authService } from './services/auth';
import { storage } from './storage';

async function seedDemoData() {
  console.log('🌱 Seeding demo data...');

  try {
    // Get the TechCorp client ID
    const techCorpClient = await storage.getClientBySubdomain('techcorp');
    if (!techCorpClient) {
      console.error('❌ TechCorp client not found');
      return;
    }

    // Create Super Admin
    const superAdminPassword = await authService.hashPassword('admin123');
    const superAdmin = await storage.createUser({
      email: 'admin@cyberaware.com',
      passwordHash: superAdminPassword,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'super_admin',
      clientId: null, // Super admin doesn't belong to a specific client
      department: 'Platform Management',
      language: 'en',
      isActive: true
    });

    // Create Client Admin for TechCorp
    const clientAdminPassword = await authService.hashPassword('admin123');
    const clientAdmin = await storage.createUser({
      email: 'admin@techcorp.com',
      passwordHash: clientAdminPassword,
      firstName: 'Tech',
      lastName: 'Administrator',
      role: 'client_admin',
      clientId: techCorpClient.id,
      department: 'IT Security',
      language: 'en',
      isActive: true
    });

    // Create End User for TechCorp
    const endUserPassword = await authService.hashPassword('user123');
    const endUser = await storage.createUser({
      email: 'user@techcorp.com',
      passwordHash: endUserPassword,
      firstName: 'John',
      lastName: 'Employee',
      role: 'end_user',
      clientId: techCorpClient.id,
      department: 'Sales',
      language: 'en',
      isActive: true
    });

    console.log('✅ Demo users created successfully:');
    console.log('   - Super Admin: admin@cyberaware.com / admin123');
    console.log('   - Client Admin: admin@techcorp.com / admin123 (techcorp)');
    console.log('   - End User: user@techcorp.com / user123 (techcorp)');

    // Create some sample courses
    const sampleCourse = await storage.createCourse({
      clientId: techCorpClient.id,
      title: 'Phishing Awareness Training',
      description: 'Learn to identify and prevent phishing attacks',
      content: {
        modules: [
          {
            id: 'module-1',
            title: 'Introduction to Phishing',
            content: `
              <h2>What is Phishing?</h2>
              <p>Phishing is a type of social engineering attack where cybercriminals use deceptive emails, websites, or messages to trick individuals into revealing sensitive information such as passwords, credit card numbers, or personal data.</p>
              
              <h3>Common Types of Phishing:</h3>
              <ul>
                <li><strong>Email Phishing:</strong> Fraudulent emails that appear to be from legitimate sources</li>
                <li><strong>Spear Phishing:</strong> Targeted attacks aimed at specific individuals or organizations</li>
                <li><strong>Whaling:</strong> Attacks targeting high-profile individuals like executives</li>
                <li><strong>Smishing:</strong> Phishing via SMS text messages</li>
                <li><strong>Vishing:</strong> Voice phishing conducted over phone calls</li>
              </ul>
              
              <h3>Warning Signs:</h3>
              <ul>
                <li>Urgent language creating a sense of emergency</li>
                <li>Generic greetings instead of personal names</li>
                <li>Suspicious sender addresses</li>
                <li>Poor grammar and spelling</li>
                <li>Unexpected attachments or links</li>
              </ul>
            `,
            duration: 15,
            quiz: {
              questions: [
                {
                  question: 'What is the primary goal of a phishing attack?',
                  options: [
                    'To install antivirus software',
                    'To steal sensitive information',
                    'To update your browser',
                    'To send newsletters'
                  ],
                  correctAnswer: 1
                },
                {
                  question: 'Which of these is a common warning sign of phishing?',
                  options: [
                    'Professional formatting',
                    'Personal greeting with your name',
                    'Urgent language creating pressure',
                    'Company logo in the email'
                  ],
                  correctAnswer: 2
                }
              ]
            }
          },
          {
            id: 'module-2',
            title: 'Real-World Examples',
            content: `
              <h2>Real Phishing Examples</h2>
              <p>Learning from real-world examples helps you recognize phishing attempts in your daily work.</p>
              
              <h3>Example 1: Fake Bank Email</h3>
              <div class="example-email">
                <strong>Subject:</strong> URGENT: Verify Your Account Within 24 Hours<br>
                <strong>From:</strong> security@bankofamerica-verify.net<br><br>
                <p>Dear Valued Customer,</p>
                <p>We have detected suspicious activity on your account. Please click the link below to verify your identity immediately or your account will be suspended.</p>
                <p><a href="#">Click Here to Verify Account</a></p>
              </div>
              
              <h3>Red Flags:</h3>
              <ul>
                <li>Suspicious domain name</li>
                <li>Generic greeting</li>
                <li>Urgent threat language</li>
                <li>Suspicious link</li>
              </ul>
              
              <h3>What to Do:</h3>
              <ol>
                <li>Do not click any links</li>
                <li>Check the sender's email address carefully</li>
                <li>Contact your bank directly using official channels</li>
                <li>Report the phishing attempt</li>
              </ol>
            `,
            duration: 20,
            quiz: {
              questions: [
                {
                  question: 'In the bank email example, what makes the domain suspicious?',
                  options: [
                    'It contains the bank name',
                    'It has "verify" in the domain',
                    'It uses a .net extension instead of .com',
                    'All of the above'
                  ],
                  correctAnswer: 3
                }
              ]
            }
          }
        ]
      },
      language: 'en',
      difficulty: 'beginner',
      estimatedDuration: 35,
      status: 'published',
      createdBy: clientAdmin.id
    });

    console.log('✅ Sample course created: Phishing Awareness Training');

    // Create sample email templates
    const phishingTemplate = await storage.createEmailTemplate({
      name: 'IT Support Verification',
      category: 'phishing',
      subject: 'IT Support: Please Verify Your Credentials',
      htmlContent: `
        <html>
        <body>
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>IT Support Team</h2>
            <p>Dear {{firstName}},</p>
            <p>We are updating our security systems and need you to verify your credentials.</p>
            <p>Please click the link below to complete the verification process:</p>
            <p><a href="{{trackingUrl}}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Credentials</a></p>
            <p>This link will expire in 24 hours.</p>
            <p>Thank you,<br>IT Support Team</p>
          </div>
        </body>
        </html>
      `,
      textContent: `
        IT Support Team
        
        Dear {{firstName}},
        
        We are updating our security systems and need you to verify your credentials.
        
        Please visit: {{trackingUrl}}
        
        This link will expire in 24 hours.
        
        Thank you,
        IT Support Team
      `,
      variables: ['firstName', 'trackingUrl'],
      isDefault: true
    });

    console.log('✅ Sample email template created');

    console.log('🎉 Demo data seeding completed successfully!');

  } catch (error) {
    console.error('❌ Error seeding demo data:', error);
    process.exit(1);
  }
}

// Run the seeding function
seedDemoData().then(() => {
  console.log('✅ Seeding process finished');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
});

export { seedDemoData };