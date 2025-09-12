import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Mail, 
  MousePointer, 
  Shield, 
  Eye, 
  Square, 
  Download,
  Calendar,
  Clock,
  Rocket,
  Edit,
  AlertTriangle,
  Building2,
  CreditCard,
  Package,
  Users,
  Zap
} from 'lucide-react';
import { api, type PhishingCampaign, type User } from '@/lib/api';

// Enhanced phishing templates based on realistic attack scenarios
const phishingTemplates = [
  {
    id: 'office365-login',
    name: 'Office 365 Security Alert',
    category: 'Credential Harvesting',
    description: 'Fake Office 365 login notification requesting immediate action',
    icon: Building2,
    color: 'bg-blue-500',
    riskLevel: 'high' as const,
    subject: 'Your Office 365 account will be suspended',
    fromName: 'Microsoft Security',
    fromEmail: 'security@microsoft-alerts.com',
    suggestedDomain: 'microsoft-alerts.com',
    preview: 'We\'ve detected unusual sign-in activity on your Office 365 account. Your account will be suspended in 24 hours unless you verify your credentials.'
  },
  {
    id: 'banking-security',
    name: 'Bank Security Alert', 
    category: 'Financial Fraud',
    description: 'Fake banking security alert requesting immediate verification',
    icon: CreditCard,
    color: 'bg-red-500',
    riskLevel: 'high' as const,
    subject: 'Urgent: Suspicious Activity Detected on Your Account',
    fromName: 'Security Team',
    fromEmail: 'security@secure-bank-alerts.com',
    suggestedDomain: 'secure-bank-alerts.com',
    preview: 'We have detected suspicious activity on your account. Please verify your identity immediately to prevent account suspension.'
  },
  {
    id: 'hr-benefits',
    name: 'HR Benefits Update',
    category: 'HR Impersonation', 
    description: 'HR benefits enrollment deadline with urgent action required',
    icon: Users,
    color: 'bg-green-500',
    riskLevel: 'medium' as const,
    subject: 'URGENT: Benefits Enrollment Deadline - Action Required',
    fromName: 'HR Benefits Team',
    fromEmail: 'benefits@company-hr.com',
    suggestedDomain: 'company-hr.com',
    preview: 'Your benefits enrollment deadline is today. You must complete your enrollment by 5:00 PM to avoid losing coverage.'
  },
  {
    id: 'zoom-meeting',
    name: 'Zoom Meeting Invitation',
    category: 'Meeting Impersonation',
    description: 'Fake meeting invitation for performance review or urgent discussion',
    icon: Zap,
    color: 'bg-blue-400',
    riskLevel: 'medium' as const,
    subject: 'Meeting Invitation: Performance Review - Tomorrow 2:00 PM',
    fromName: 'Sarah Johnson',
    fromEmail: 'sarah.johnson@company.com',
    suggestedDomain: 'company-meetings.com',
    preview: 'Hi! I\'ve scheduled a performance review meeting for tomorrow at 2:00 PM. Please click the link below to join the meeting.'
  },
  {
    id: 'netflix-suspension',
    name: 'Netflix Account Suspension',
    category: 'Subscription Scam',
    description: 'Fake Netflix suspension notice requiring payment update',
    icon: Eye,
    color: 'bg-red-600',
    riskLevel: 'medium' as const,
    subject: 'Your Netflix account has been suspended',
    fromName: 'Netflix',
    fromEmail: 'account@netflix-billing.com',
    suggestedDomain: 'netflix-billing.com',
    preview: 'We were unable to process your payment. Your account has been suspended. Please update your payment information to restore access.'
  },
  {
    id: 'irs-refund',
    name: 'IRS Tax Refund Notice',
    category: 'Government Impersonation',
    description: 'Fake IRS communication about tax refund requiring personal information',
    icon: AlertTriangle,
    color: 'bg-yellow-600',
    riskLevel: 'high' as const,
    subject: 'IRS Notice: You have a pending tax refund of $2,847',
    fromName: 'Internal Revenue Service',
    fromEmail: 'refunds@irs-treasury.gov',
    suggestedDomain: 'irs-treasury.gov',
    preview: 'You have a pending federal tax refund. Click below to verify your information and claim your refund before it expires.'
  },
  {
    id: 'it-password-expire',
    name: 'IT Password Expiration',
    category: 'IT Support',
    description: 'Password expiration notice requiring immediate action',
    icon: Shield,
    color: 'bg-orange-500',
    riskLevel: 'medium' as const,
    subject: 'Password Expiration Notice - Action Required',
    fromName: 'IT Support',
    fromEmail: 'support@company-it.com',
    suggestedDomain: 'company-it.com',
    preview: 'Your password will expire in 24 hours. Please update your credentials to maintain access to company systems.'
  },
  {
    id: 'package-delivery',
    name: 'Package Delivery Failed',
    category: 'Package Delivery',
    description: 'Failed delivery notification requiring rescheduling',
    icon: Package,
    color: 'bg-brown-500',
    riskLevel: 'low' as const,
    subject: 'Package Delivery Attempt Failed - Reschedule Required',
    fromName: 'UPS Delivery',
    fromEmail: 'delivery@ups-notifications.com',
    suggestedDomain: 'ups-notifications.com',
    preview: 'We attempted to deliver your package but no one was available. Please click below to reschedule your delivery.'
  }
];

export default function PhishingCampaigns() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<typeof phishingTemplates[0] | null>(null);
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    domain: '',
    targetGroups: [] as string[],
    template: '',
    scheduledDate: '',
    scheduledTime: ''
  });

  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery({
    queryKey: ['campaigns', currentUser?.clientId],
    queryFn: () => api.getCampaigns(currentUser?.clientId),
    enabled: !!currentUser
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users', currentUser?.clientId],
    queryFn: () => api.getUsers(currentUser?.clientId),
    enabled: !!currentUser
  });

  const createCampaignMutation = useMutation({
    mutationFn: api.createCampaign,
    onSuccess: () => {
      toast({
        title: 'Campaign Created',
        description: 'Your phishing campaign has been created successfully.'
      });
      setShowCreateForm(false);
      setFormData({
        name: '',
        domain: '',
        targetGroups: [],
        template: '',
        scheduledDate: '',
        scheduledTime: ''
      });
      setSelectedTemplate(null);
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Create Campaign',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const launchCampaignMutation = useMutation({
    mutationFn: api.launchCampaign,
    onSuccess: (data) => {
      toast({
        title: 'Campaign Launched',
        description: `${data.emailsSent} emails sent successfully.`
      });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Launch Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Calculate campaign stats
  const totalEmailsSent = campaigns.reduce((sum, c) => sum + (c.emailsSent || 0), 0);
  const totalOpened = campaigns.reduce((sum, c) => sum + (c.emailsOpened || 0), 0);
  const totalClicked = campaigns.reduce((sum, c) => sum + (c.emailsClicked || 0), 0);
  const totalReported = campaigns.reduce((sum, c) => sum + (c.emailsReported || 0), 0);

  const clickRate = totalEmailsSent > 0 ? ((totalClicked / totalEmailsSent) * 100).toFixed(1) : '0.0';
  const reportedRate = totalEmailsSent > 0 ? ((totalReported / totalEmailsSent) * 100).toFixed(1) : '0.0';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const template = getTemplateData(formData.template);
    const campaignData = {
      name: formData.name,
      template: {
        subject: template.subject,
        fromName: template.fromName,
        fromEmail: template.fromEmail,
        domain: formData.domain,
        templateId: template.id
      },
      targetGroups: formData.targetGroups,
      scheduledAt: formData.scheduledDate && formData.scheduledTime ? 
        new Date(`${formData.scheduledDate}T${formData.scheduledTime}`).toISOString() : undefined,
      status: 'draft' as const
    };

    createCampaignMutation.mutate(campaignData);
  };

  const getTemplateData = (templateId: string) => {
    const template = phishingTemplates.find(t => t.id === templateId);
    if (!template) return phishingTemplates[0]; // fallback to first template
    return template;
  };

  const handleTemplateSelect = (template: typeof phishingTemplates[0]) => {
    setSelectedTemplate(template);
    setFormData(prev => ({
      ...prev,
      template: template.id,
      domain: template.suggestedDomain
    }));
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'draft':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'scheduled':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Zap className="w-4 h-4" />;
      case 'completed':
        return <Shield className="w-4 h-4" />;
      case 'draft':
        return <Edit className="w-4 h-4" />;
      case 'paused':
        return <Clock className="w-4 h-4" />;
      case 'scheduled':
        return <Calendar className="w-4 h-4" />;
      default:
        return <Square className="w-4 h-4" />;
    }
  };

  const getDepartments = () => {
    const departments = Array.from(new Set(users.map(u => u.department).filter(Boolean)));
    return departments;
  };

  if (campaignsLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold" data-testid="heading-phishing-campaigns">
          Phishing Campaigns
        </h2>
        <Button 
          onClick={() => setShowCreateForm(true)}
          data-testid="button-create-campaign"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Campaign
        </Button>
      </div>

      {/* Campaign Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Emails Sent</p>
                <p className="text-2xl font-bold text-accent" data-testid="stat-emails-sent">
                  {totalEmailsSent.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                <Mail className="text-accent text-xl" />
              </div>
            </div>
            <div className="mt-4 text-sm text-muted-foreground">
              <span>Across {campaigns.length} campaigns</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Click Rate</p>
                <p className="text-2xl font-bold text-destructive" data-testid="stat-click-rate">
                  {clickRate}%
                </p>
              </div>
              <div className="w-12 h-12 bg-destructive/10 rounded-lg flex items-center justify-center">
                <MousePointer className="text-destructive text-xl" />
              </div>
            </div>
            <div className="flex items-center mt-4 text-sm">
              <span className="text-muted-foreground">
                {totalClicked} of {totalEmailsSent} emails clicked
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Reported as Phishing</p>
                <p className="text-2xl font-bold text-green-600" data-testid="stat-reported-rate">
                  {reportedRate}%
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Shield className="text-green-600 text-xl" />
              </div>
            </div>
            <div className="flex items-center mt-4 text-sm">
              <span className="text-muted-foreground">
                {totalReported} emails reported correctly
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create Campaign Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Campaign</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="campaign-name">Campaign Name</Label>
                    <Input
                      id="campaign-name"
                      placeholder="Q4 Security Awareness Test"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                      data-testid="input-campaign-name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="phishing-domain">Phishing Domain</Label>
                    <Select
                      value={formData.domain}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, domain: value }))}
                    >
                      <SelectTrigger data-testid="select-phishing-domain">
                        <SelectValue placeholder={selectedTemplate ? `Suggested: ${selectedTemplate.suggestedDomain}` : 'Select a template first'} />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedTemplate && (
                          <SelectItem value={selectedTemplate.suggestedDomain}>
                            {selectedTemplate.suggestedDomain} (Recommended)
                          </SelectItem>
                        )}
                        <SelectItem value="secure-bank-alerts.com">secure-bank-alerts.com</SelectItem>
                        <SelectItem value="microsoft-alerts.com">microsoft-alerts.com</SelectItem>
                        <SelectItem value="company-hr.com">company-hr.com</SelectItem>
                        <SelectItem value="company-it.com">company-it.com</SelectItem>
                        <SelectItem value="netflix-billing.com">netflix-billing.com</SelectItem>
                        <SelectItem value="irs-treasury.gov">irs-treasury.gov</SelectItem>
                        <SelectItem value="ups-notifications.com">ups-notifications.com</SelectItem>
                        <SelectItem value="company-meetings.com">company-meetings.com</SelectItem>
                      </SelectContent>
                    </Select>
                    {selectedTemplate && formData.domain === selectedTemplate.suggestedDomain && (
                      <p className="text-xs text-green-600 mt-1">
                        ✓ Using recommended domain for maximum realism
                      </p>
                    )}
                  </div>

                  <div>
                    <Label>Target Groups</Label>
                    <div className="space-y-2 mt-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="all-users"
                          checked={formData.targetGroups.includes('all')}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFormData(prev => ({ ...prev, targetGroups: ['all'] }));
                            } else {
                              setFormData(prev => ({ ...prev, targetGroups: [] }));
                            }
                          }}
                          data-testid="checkbox-all-users"
                        />
                        <Label htmlFor="all-users">All Users ({users.length})</Label>
                      </div>
                      {getDepartments().map(dept => (
                        <div key={dept} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`dept-${dept}`}
                            checked={formData.targetGroups.includes(dept || '')}
                            onCheckedChange={(checked) => {
                              if (checked && dept) {
                                setFormData(prev => ({
                                  ...prev,
                                  targetGroups: [...prev.targetGroups.filter(g => g !== 'all'), dept]
                                }));
                              } else if (dept) {
                                setFormData(prev => ({
                                  ...prev,
                                  targetGroups: prev.targetGroups.filter(g => g !== dept)
                                }));
                              }
                            }}
                            data-testid={`checkbox-dept-${dept}`}
                          />
                          <Label htmlFor={`dept-${dept}`}>
                            {dept} ({users.filter(u => u.department === dept).length})
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>Schedule</Label>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <Input
                        type="date"
                        value={formData.scheduledDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, scheduledDate: e.target.value }))}
                        data-testid="input-scheduled-date"
                      />
                      <Input
                        type="time"
                        value={formData.scheduledTime}
                        onChange={(e) => setFormData(prev => ({ ...prev, scheduledTime: e.target.value }))}
                        data-testid="input-scheduled-time"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Label>Email Template</Label>
                    <div className="grid grid-cols-1 gap-3 mt-2">
                      {phishingTemplates.map(template => {
                        const Icon = template.icon;
                        const isSelected = formData.template === template.id;
                        return (
                          <div
                            key={template.id}
                            className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                              isSelected
                                ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                                : 'border-border hover:bg-muted/30'
                            }`}
                            onClick={() => handleTemplateSelect(template)}
                            data-testid={`template-${template.id}`}
                          >
                            <div className="flex items-start space-x-3">
                              <div className={`p-2 rounded-lg ${template.color} bg-opacity-20`}>
                                <Icon className={`w-5 h-5 ${template.color.replace('bg-', 'text-')}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <h4 className="font-semibold text-sm">{template.name}</h4>
                                  <div className="flex items-center space-x-2">
                                    <Badge className={`${getRiskLevelColor(template.riskLevel)} text-xs px-2 py-1`}>
                                      {template.riskLevel}
                                    </Badge>
                                    <div className={`w-4 h-4 rounded-full border-2 ${
                                      isSelected
                                        ? 'border-primary bg-primary' 
                                        : 'border-muted-foreground'
                                    }`} />
                                  </div>
                                </div>
                                <p className="text-xs text-muted-foreground mb-2">{template.category}</p>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                  {template.preview}
                                </p>
                              </div>
                            </div>
                            {isSelected && (
                              <div className="mt-3 pt-3 border-t border-primary/20">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">Subject: {template.subject}</span>
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button variant="outline" size="sm" className="h-6 text-xs">
                                        <Eye className="w-3 h-3 mr-1" />
                                        Preview
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-2xl max-h-[80vh]">
                                      <DialogHeader>
                                        <DialogTitle>{template.name} - Email Preview</DialogTitle>
                                      </DialogHeader>
                                      <ScrollArea className="h-96">
                                        <div className="p-4 bg-muted/30 rounded-lg">
                                          <div className="mb-4 text-sm space-y-1">
                                            <div><strong>From:</strong> {template.fromName} &lt;{template.fromEmail}&gt;</div>
                                            <div><strong>Subject:</strong> {template.subject}</div>
                                            <div><strong>Risk Level:</strong> 
                                              <Badge className={`ml-2 ${getRiskLevelColor(template.riskLevel)}`}>
                                                {template.riskLevel}
                                              </Badge>
                                            </div>
                                          </div>
                                          <hr className="my-4" />
                                          <div className="prose prose-sm max-w-none">
                                            <p>{template.preview}</p>
                                            <p className="text-primary underline cursor-pointer">[Phishing Link - Click Here]</p>
                                            <p className="text-xs text-muted-foreground mt-4">
                                              This is a preview of the phishing email template. The actual email will contain personalized content and tracking links.
                                            </p>
                                          </div>
                                        </div>
                                      </ScrollArea>
                                    </DialogContent>
                                  </Dialog>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  {selectedTemplate && (
                    <div className="space-y-3">
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <h4 className="text-sm font-medium mb-2">Selected Template Details</h4>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div>From: {selectedTemplate.fromName} &lt;{selectedTemplate.fromEmail}&gt;</div>
                          <div>Domain: {selectedTemplate.suggestedDomain}</div>
                          <div>Category: {selectedTemplate.category}</div>
                        </div>
                      </div>
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="w-full"
                        disabled
                        data-testid="button-customize-template"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Customize Template (Coming Soon)
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex justify-end space-x-3">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                  data-testid="button-cancel-campaign"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createCampaignMutation.isPending}
                  data-testid="button-create-campaign-submit"
                >
                  {createCampaignMutation.isPending ? (
                    <>
                      <div className="loading-spinner w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full mr-2"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <Rocket className="w-4 h-4 mr-2" />
                      Create Campaign
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Active Campaigns */}
      <Card>
        <CardHeader>
          <CardTitle>Campaigns</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-4 font-medium text-sm">Campaign</th>
                  <th className="text-left p-4 font-medium text-sm">Target Count</th>
                  <th className="text-left p-4 font-medium text-sm">Sent</th>
                  <th className="text-left p-4 font-medium text-sm">Opened</th>
                  <th className="text-left p-4 font-medium text-sm">Clicked</th>
                  <th className="text-left p-4 font-medium text-sm">Reported</th>
                  <th className="text-left p-4 font-medium text-sm">Status</th>
                  <th className="text-left p-4 font-medium text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      No campaigns created yet
                    </td>
                  </tr>
                ) : (
                  campaigns.map((campaign: PhishingCampaign) => (
                    <tr key={campaign.id} className="border-t border-border hover:bg-muted/30">
                      <td className="p-4">
                        <div>
                          <p className="font-medium" data-testid={`campaign-name-${campaign.id}`}>
                            {campaign.name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {campaign.template.domain}
                          </p>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="font-medium">{campaign.targetGroups.length}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm">{campaign.emailsSent || 0}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm">
                          {campaign.emailsSent > 0 ? 
                            `${((campaign.emailsOpened / campaign.emailsSent) * 100).toFixed(1)}%` : 
                            '0%'
                          }
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-destructive font-medium">
                          {campaign.emailsSent > 0 ? 
                            `${((campaign.emailsClicked / campaign.emailsSent) * 100).toFixed(1)}%` : 
                            '0%'
                          }
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-green-600 font-medium">
                          {campaign.emailsSent > 0 ? 
                            `${((campaign.emailsReported / campaign.emailsSent) * 100).toFixed(1)}%` : 
                            '0%'
                          }
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-2">
                          <Badge className={`${getStatusColor(campaign.status)} border flex items-center space-x-1`}>
                            {getStatusIcon(campaign.status)}
                            <span className="capitalize">{campaign.status}</span>
                          </Badge>
                          {campaign.status === 'active' && (
                            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                              <span>Live</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            data-testid={`button-view-campaign-${campaign.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {campaign.status === 'draft' && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => launchCampaignMutation.mutate(campaign.id)}
                              disabled={launchCampaignMutation.isPending}
                              data-testid={`button-launch-campaign-${campaign.id}`}
                            >
                              <Rocket className="w-4 h-4" />
                            </Button>
                          )}
                          {campaign.status === 'active' && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              data-testid={`button-stop-campaign-${campaign.id}`}
                            >
                              <Square className="w-4 h-4" />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm"
                            data-testid={`button-export-campaign-${campaign.id}`}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
