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
    const superAdmin = await storage.createUser({
      email: 'admin@cyberaware.com',
      password: 'admin123',
      firstName: 'Super',
      lastName: 'Admin',
      role: 'super_admin',
      clientId: null, // Super admin doesn't belong to a specific client
      department: 'Platform Management',
      language: 'en',
      isActive: true
    });

    // Create Client Admin for TechCorp
    const clientAdmin = await storage.createUser({
      email: 'admin@techcorp.com',
      password: 'admin123',
      firstName: 'Tech',
      lastName: 'Administrator',
      role: 'client_admin',
      clientId: techCorpClient.id,
      department: 'IT Security',
      language: 'en',
      isActive: true
    });

    // Create End User for TechCorp
    const endUser = await storage.createUser({
      email: 'user@techcorp.com',
      password: 'user123',
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

    // Course 2: Password Security Best Practices
    const passwordCourse = await storage.createCourse({
      clientId: techCorpClient.id,
      title: 'Password Security Best Practices',
      description: 'Master the art of creating and managing secure passwords to protect your accounts',
      content: {
        modules: [
          {
            id: 'pass-module-1',
            title: 'Understanding Password Threats',
            content: `
              <h2>The Password Security Landscape</h2>
              <p>In today's digital world, passwords are the first line of defense against unauthorized access to your accounts and sensitive information.</p>
              
              <h3>Common Password Threats:</h3>
              <ul>
                <li><strong>Brute Force Attacks:</strong> Automated attempts to guess your password by trying millions of combinations</li>
                <li><strong>Dictionary Attacks:</strong> Using common words and phrases to crack passwords</li>
                <li><strong>Rainbow Table Attacks:</strong> Pre-computed hash lookups to reverse engineer passwords</li>
                <li><strong>Credential Stuffing:</strong> Using leaked passwords from one breach to access other accounts</li>
                <li><strong>Social Engineering:</strong> Tricking users into revealing their passwords</li>
              </ul>
              
              <h3>The Cost of Weak Passwords:</h3>
              <ul>
                <li>80% of data breaches involve compromised passwords</li>
                <li>Average cost of a data breach: $4.35 million</li>
                <li>60% of people reuse passwords across multiple accounts</li>
                <li>The most common password is still "123456"</li>
              </ul>
              
              <h3>Password Attack Methods:</h3>
              <ul>
                <li><strong>Keyloggers:</strong> Malware that records your keystrokes</li>
                <li><strong>Phishing:</strong> Fake websites that steal your credentials</li>
                <li><strong>Shoulder Surfing:</strong> Watching someone type their password</li>
                <li><strong>Password Spraying:</strong> Trying common passwords across many accounts</li>
              </ul>
            `,
            duration: 15,
            quiz: {
              questions: [
                {
                  question: 'What percentage of data breaches involve compromised passwords?',
                  options: ['20%', '50%', '80%', '95%'],
                  correctAnswer: 2
                },
                {
                  question: 'Which attack uses pre-computed hashes to crack passwords?',
                  options: ['Dictionary Attack', 'Rainbow Table Attack', 'Brute Force Attack', 'Social Engineering'],
                  correctAnswer: 1
                },
                {
                  question: 'What is credential stuffing?',
                  options: [
                    'Creating fake credentials',
                    'Using leaked passwords to access other accounts',
                    'Storing credentials insecurely',
                    'Sharing credentials with others'
                  ],
                  correctAnswer: 1
                }
              ]
            }
          },
          {
            id: 'pass-module-2',
            title: 'Creating Strong Passwords',
            content: `
              <h2>Building Unbreakable Passwords</h2>
              <p>A strong password is your first defense against cyber attacks. Learn how to create passwords that are both secure and memorable.</p>
              
              <h3>Password Strength Criteria:</h3>
              <ul>
                <li><strong>Length:</strong> Minimum 12 characters, ideally 16 or more</li>
                <li><strong>Complexity:</strong> Mix of uppercase, lowercase, numbers, and symbols</li>
                <li><strong>Unpredictability:</strong> Avoid dictionary words and personal information</li>
                <li><strong>Uniqueness:</strong> Different password for every account</li>
              </ul>
              
              <h3>Password Creation Techniques:</h3>
              
              <h4>1. Passphrase Method:</h4>
              <p>Combine random words with numbers and symbols</p>
              <p>Example: Coffee!Purple7Telescope@Moon</p>
              
              <h4>2. Sentence Method:</h4>
              <p>Take the first letter of each word in a memorable sentence</p>
              <p>Example: "I love to eat pizza on Fridays at 8pm!" becomes "Il2epoF@8p!"</p>
              
              <h4>3. Substitution Method:</h4>
              <p>Replace letters with numbers and symbols</p>
              <p>Example: "SecurePassword" becomes "S3cur3P@$$w0rd"</p>
              
              <h3>What to Avoid:</h3>
              <ul>
                <li>Personal information (birthdays, names, addresses)</li>
                <li>Common passwords (password123, qwerty, admin)</li>
                <li>Dictionary words without modification</li>
                <li>Keyboard patterns (asdfgh, 123456)</li>
                <li>Repeated characters (aaaaaa, 111111)</li>
              </ul>
              
              <h3>Testing Password Strength:</h3>
              <p>A strong password should take billions of years to crack with current technology. Test your passwords with reputable strength checkers, but never enter your actual password online.</p>
            `,
            duration: 20,
            quiz: {
              questions: [
                {
                  question: 'What is the minimum recommended password length for strong security?',
                  options: ['6 characters', '8 characters', '12 characters', '20 characters'],
                  correctAnswer: 2
                },
                {
                  question: 'Which password creation method uses the first letters of a sentence?',
                  options: ['Passphrase Method', 'Sentence Method', 'Substitution Method', 'Dictionary Method'],
                  correctAnswer: 1
                },
                {
                  question: 'Which of these makes the strongest password?',
                  options: [
                    'YourName2024',
                    'P@ssword123',
                    'Coffee!Purple7Telescope@Moon',
                    'qwertyuiop'
                  ],
                  correctAnswer: 2
                }
              ]
            }
          },
          {
            id: 'pass-module-3',
            title: 'Password Management Solutions',
            content: `
              <h2>Managing Passwords Effectively</h2>
              <p>With dozens of online accounts, managing unique, strong passwords for each is challenging. Learn about tools and strategies to maintain password security.</p>
              
              <h3>Password Managers:</h3>
              <p>Password managers are encrypted vaults that store and auto-fill your passwords.</p>
              
              <h4>Benefits:</h4>
              <ul>
                <li>Generate strong, unique passwords automatically</li>
                <li>Store unlimited passwords securely</li>
                <li>Auto-fill credentials on websites</li>
                <li>Sync across all your devices</li>
                <li>Secure password sharing with team members</li>
                <li>Alert you to compromised passwords</li>
              </ul>
              
              <h4>Popular Password Managers:</h4>
              <ul>
                <li><strong>1Password:</strong> Enterprise-friendly with excellent team features</li>
                <li><strong>Bitwarden:</strong> Open-source with free tier available</li>
                <li><strong>LastPass:</strong> User-friendly with good browser integration</li>
                <li><strong>Dashlane:</strong> Includes VPN and dark web monitoring</li>
              </ul>
              
              <h3>Two-Factor Authentication (2FA):</h3>
              <p>Add an extra layer of security beyond passwords.</p>
              
              <h4>Types of 2FA:</h4>
              <ul>
                <li><strong>SMS/Text:</strong> Code sent to your phone (least secure)</li>
                <li><strong>Authenticator Apps:</strong> Time-based codes (Google Authenticator, Authy)</li>
                <li><strong>Hardware Keys:</strong> Physical USB devices (YubiKey, Titan)</li>
                <li><strong>Biometric:</strong> Fingerprint or face recognition</li>
              </ul>
              
              <h3>Password Hygiene Best Practices:</h3>
              <ul>
                <li>Change passwords immediately after a breach</li>
                <li>Never share passwords via email or chat</li>
                <li>Use unique passwords for every account</li>
                <li>Enable 2FA wherever possible</li>
                <li>Regularly review and update old passwords</li>
                <li>Be cautious of password reset emails</li>
              </ul>
            `,
            duration: 25,
            quiz: {
              questions: [
                {
                  question: 'What is the main benefit of using a password manager?',
                  options: [
                    'It remembers your birthday',
                    'It generates and stores unique passwords for each account',
                    'It makes passwords easier to guess',
                    'It shares passwords publicly'
                  ],
                  correctAnswer: 1
                },
                {
                  question: 'Which type of 2FA is considered most secure?',
                  options: ['SMS/Text codes', 'Email verification', 'Hardware keys', 'Security questions'],
                  correctAnswer: 2
                },
                {
                  question: 'How often should you change passwords after a data breach?',
                  options: ['Never', 'Once a year', 'Immediately', 'Every 5 years'],
                  correctAnswer: 2
                }
              ]
            }
          }
        ]
      },
      language: 'en',
      difficulty: 'beginner',
      estimatedDuration: 60,
      status: 'published',
      createdBy: clientAdmin.id
    });

    console.log('✅ Sample course created: Password Security Best Practices');

    // Course 3: Social Engineering Defense
    const socialEngineeringCourse = await storage.createCourse({
      clientId: techCorpClient.id,
      title: 'Social Engineering Defense',
      description: 'Learn to recognize and defend against manipulation tactics used by cybercriminals',
      content: {
        modules: [
          {
            id: 'social-module-1',
            title: 'Understanding Social Engineering',
            content: `
              <h2>The Human Factor in Cybersecurity</h2>
              <p>Social engineering exploits human psychology rather than technical vulnerabilities. It's often easier to trick someone into giving away their password than to hack it.</p>
              
              <h3>What is Social Engineering?</h3>
              <p>Social engineering is the art of manipulating people to divulge confidential information or perform actions that compromise security.</p>
              
              <h3>Why Social Engineering Works:</h3>
              <ul>
                <li><strong>Trust:</strong> Humans naturally want to trust others</li>
                <li><strong>Fear:</strong> Threats create urgency and cloud judgment</li>
                <li><strong>Authority:</strong> People comply with perceived authority figures</li>
                <li><strong>Reciprocity:</strong> We feel obligated to return favors</li>
                <li><strong>Social Proof:</strong> We follow what others are doing</li>
                <li><strong>Scarcity:</strong> Limited availability drives action</li>
              </ul>
              
              <h3>Common Social Engineering Attacks:</h3>
              <ul>
                <li><strong>Pretexting:</strong> Creating false scenarios to obtain information</li>
                <li><strong>Baiting:</strong> Offering something enticing to spark curiosity</li>
                <li><strong>Quid Pro Quo:</strong> Offering a service in exchange for information</li>
                <li><strong>Tailgating:</strong> Following authorized personnel into restricted areas</li>
                <li><strong>Watering Hole:</strong> Compromising websites frequently visited by targets</li>
              </ul>
              
              <h3>Real-World Examples:</h3>
              <ul>
                <li>The "CEO Fraud" that cost companies $12.5 billion</li>
                <li>The Twitter hack that compromised celebrity accounts</li>
                <li>The MGM Resorts breach through a simple phone call</li>
              </ul>
            `,
            duration: 20,
            quiz: {
              questions: [
                {
                  question: 'What does social engineering primarily exploit?',
                  options: [
                    'Computer vulnerabilities',
                    'Network weaknesses',
                    'Human psychology',
                    'Software bugs'
                  ],
                  correctAnswer: 2
                },
                {
                  question: 'Which psychological principle involves feeling obligated to return favors?',
                  options: ['Authority', 'Reciprocity', 'Scarcity', 'Fear'],
                  correctAnswer: 1
                },
                {
                  question: 'What is "pretexting" in social engineering?',
                  options: [
                    'Sending text messages',
                    'Creating false scenarios to obtain information',
                    'Following someone into a building',
                    'Offering free services'
                  ],
                  correctAnswer: 1
                }
              ]
            }
          },
          {
            id: 'social-module-2',
            title: 'Recognizing Social Engineering Tactics',
            content: `
              <h2>Identifying Manipulation Attempts</h2>
              <p>Learn to spot the red flags and warning signs of social engineering attacks before you become a victim.</p>
              
              <h3>Red Flags to Watch For:</h3>
              
              <h4>1. Urgency and Pressure:</h4>
              <ul>
                <li>"Act now or lose access to your account"</li>
                <li>"This offer expires in 24 hours"</li>
                <li>"Immediate action required"</li>
              </ul>
              
              <h4>2. Unusual Requests:</h4>
              <ul>
                <li>Asking for passwords or sensitive information</li>
                <li>Requesting wire transfers or gift cards</li>
                <li>Bypassing normal procedures</li>
              </ul>
              
              <h4>3. Emotional Manipulation:</h4>
              <ul>
                <li>Creating fear ("Your account has been compromised")</li>
                <li>Exploiting greed ("You've won $1 million")</li>
                <li>Using sympathy ("I need help urgently")</li>
              </ul>
              
              <h3>Common Scenarios:</h3>
              
              <h4>Phone-Based Attacks (Vishing):</h4>
              <ul>
                <li>Fake tech support calls</li>
                <li>IRS or government impersonation</li>
                <li>Bank fraud alerts</li>
                <li>Survey scams</li>
              </ul>
              
              <h4>Email-Based Attacks:</h4>
              <ul>
                <li>CEO fraud/Business Email Compromise</li>
                <li>Invoice scams</li>
                <li>Charity fraud</li>
                <li>Romance scams</li>
              </ul>
              
              <h4>In-Person Attacks:</h4>
              <ul>
                <li>Impersonating service personnel</li>
                <li>Tailgating into secure areas</li>
                <li>Dumpster diving for information</li>
                <li>Shoulder surfing</li>
              </ul>
              
              <h3>Verification Techniques:</h3>
              <ul>
                <li>Independently verify caller identity</li>
                <li>Use known contact information, not provided numbers</li>
                <li>Check email addresses carefully</li>
                <li>Verify requests through separate channels</li>
                <li>When in doubt, say no and verify</li>
              </ul>
            `,
            duration: 25,
            quiz: {
              questions: [
                {
                  question: 'Which is a common red flag in social engineering attacks?',
                  options: [
                    'Taking time to verify information',
                    'Following normal procedures',
                    'Creating artificial urgency',
                    'Using official channels'
                  ],
                  correctAnswer: 2
                },
                {
                  question: 'What should you do when receiving an unusual request from your "CEO"?',
                  options: [
                    'Comply immediately',
                    'Verify through a separate channel',
                    'Reply to the email',
                    'Ignore it'
                  ],
                  correctAnswer: 1
                },
                {
                  question: 'What is "vishing"?',
                  options: [
                    'Video conferencing scam',
                    'Voice/phone-based social engineering',
                    'Visiting malicious websites',
                    'Virtual reality hacking'
                  ],
                  correctAnswer: 1
                }
              ]
            }
          },
          {
            id: 'social-module-3',
            title: 'Building Your Defense Strategy',
            content: `
              <h2>Protecting Yourself and Your Organization</h2>
              <p>Develop a comprehensive defense strategy against social engineering attacks through awareness, policies, and technical controls.</p>
              
              <h3>Personal Defense Strategies:</h3>
              
              <h4>1. Healthy Skepticism:</h4>
              <ul>
                <li>Question unexpected requests</li>
                <li>Verify identities independently</li>
                <li>Don't trust caller ID or email addresses alone</li>
                <li>Be suspicious of unsolicited help</li>
              </ul>
              
              <h4>2. Information Protection:</h4>
              <ul>
                <li>Limit personal information on social media</li>
                <li>Be cautious about survey participation</li>
                <li>Shred sensitive documents</li>
                <li>Use privacy settings effectively</li>
              </ul>
              
              <h4>3. Communication Security:</h4>
              <ul>
                <li>Never share passwords or PINs</li>
                <li>Avoid discussing sensitive information in public</li>
                <li>Use encrypted communication for sensitive data</li>
                <li>Be aware of your surroundings</li>
              </ul>
              
              <h3>Organizational Defenses:</h3>
              
              <h4>Security Policies:</h4>
              <ul>
                <li>Clear information classification guidelines</li>
                <li>Visitor management procedures</li>
                <li>Incident reporting protocols</li>
                <li>Regular security awareness training</li>
              </ul>
              
              <h4>Technical Controls:</h4>
              <ul>
                <li>Email filtering and anti-phishing tools</li>
                <li>Multi-factor authentication</li>
                <li>Access control systems</li>
                <li>Security monitoring and logging</li>
              </ul>
              
              <h3>Incident Response:</h3>
              <p>If you suspect you've been targeted:</p>
              <ol>
                <li>Don't panic or feel embarrassed</li>
                <li>Stop all communication with the attacker</li>
                <li>Report to IT security immediately</li>
                <li>Change potentially compromised passwords</li>
                <li>Monitor accounts for suspicious activity</li>
                <li>Document everything for investigation</li>
              </ol>
              
              <h3>Creating a Security Culture:</h3>
              <ul>
                <li>Encourage reporting without blame</li>
                <li>Regular security awareness training</li>
                <li>Simulated phishing exercises</li>
                <li>Reward security-conscious behavior</li>
                <li>Share lessons learned from incidents</li>
              </ul>
            `,
            duration: 30,
            quiz: {
              questions: [
                {
                  question: 'What is the first step if you suspect you\'ve been targeted by social engineering?',
                  options: [
                    'Delete all evidence',
                    'Confront the attacker',
                    'Stop all communication with the attacker',
                    'Post about it on social media'
                  ],
                  correctAnswer: 2
                },
                {
                  question: 'Which is an effective organizational defense against social engineering?',
                  options: [
                    'Hiding all company information',
                    'Regular security awareness training',
                    'Avoiding all external communication',
                    'Trusting all employees completely'
                  ],
                  correctAnswer: 1
                },
                {
                  question: 'What should you do with sensitive documents you no longer need?',
                  options: [
                    'Throw them in the trash',
                    'Leave them on your desk',
                    'Shred them',
                    'Give them to anyone who asks'
                  ],
                  correctAnswer: 2
                }
              ]
            }
          }
        ]
      },
      language: 'en',
      difficulty: 'intermediate',
      estimatedDuration: 75,
      status: 'published',
      createdBy: clientAdmin.id
    });

    console.log('✅ Sample course created: Social Engineering Defense');

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