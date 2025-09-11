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
  Edit
} from 'lucide-react';
import { api, type PhishingCampaign, type User } from '@/lib/api';

export default function PhishingCampaigns() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    domain: 'secure-bank-update.com',
    targetGroups: [] as string[],
    template: 'banking',
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
        domain: 'secure-bank-update.com',
        targetGroups: [],
        template: 'banking',
        scheduledDate: '',
        scheduledTime: ''
      });
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
    
    const campaignData = {
      name: formData.name,
      template: {
        subject: getTemplateData(formData.template).subject,
        htmlContent: getTemplateData(formData.template).htmlContent,
        textContent: getTemplateData(formData.template).textContent,
        fromName: getTemplateData(formData.template).fromName,
        fromEmail: getTemplateData(formData.template).fromEmail,
        domain: formData.domain
      },
      targetGroups: formData.targetGroups,
      scheduledAt: formData.scheduledDate && formData.scheduledTime ? 
        new Date(`${formData.scheduledDate}T${formData.scheduledTime}`).toISOString() : undefined,
      status: 'draft' as const
    };

    createCampaignMutation.mutate(campaignData);
  };

  const getTemplateData = (templateType: string) => {
    const templates = {
      banking: {
        subject: 'Urgent: Suspicious Activity Detected on Your Account',
        fromName: 'Security Team',
        fromEmail: 'security@secure-bank-update.com',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px;">
            <h2 style="color: #d32f2f;">Security Alert</h2>
            <p>Dear {{firstName}},</p>
            <p>We have detected suspicious activity on your account. Please verify your identity immediately to prevent account suspension.</p>
            <p><a href="{{trackingUrl}}" style="background: #1976d2; color: white; padding: 12px 24px; text-decoration: none;">Verify Account</a></p>
            <p>Thank you,<br>Security Team</p>
          </div>
        `,
        textContent: 'Security Alert: Suspicious activity detected. Please verify your account.'
      },
      'it-support': {
        subject: 'Password Expiration Notice - Action Required',
        fromName: 'IT Support',
        fromEmail: 'support@company-it.com',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px;">
            <h2>Password Expiration Notice</h2>
            <p>Hello {{firstName}},</p>
            <p>Your password will expire in 24 hours. Please update your credentials to maintain access.</p>
            <p><a href="{{trackingUrl}}" style="background: #f57c00; color: white; padding: 12px 24px; text-decoration: none;">Update Password</a></p>
            <p>IT Support Team</p>
          </div>
        `,
        textContent: 'Your password expires soon. Please update your credentials.'
      },
      delivery: {
        subject: 'Package Delivery Attempt Failed',
        fromName: 'Delivery Service',
        fromEmail: 'delivery@quick-ship.com',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px;">
            <h2>Delivery Attempt Failed</h2>
            <p>Dear {{firstName}},</p>
            <p>We attempted to deliver your package but no one was available. Please reschedule delivery.</p>
            <p><a href="{{trackingUrl}}" style="background: #388e3c; color: white; padding: 12px 24px; text-decoration: none;">Reschedule Delivery</a></p>
            <p>Quick Ship Delivery</p>
          </div>
        `,
        textContent: 'Delivery failed. Please reschedule your package delivery.'
      }
    };
    return templates[templateType as keyof typeof templates] || templates.banking;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="secure-bank-update.com">secure-bank-update.com</SelectItem>
                        <SelectItem value="microsoft-security-alert.net">microsoft-security-alert.net</SelectItem>
                        <SelectItem value="paypal-verification.org">paypal-verification.org</SelectItem>
                        <SelectItem value="amazon-account-suspended.co">amazon-account-suspended.co</SelectItem>
                      </SelectContent>
                    </Select>
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
                    <div className="space-y-3 mt-2">
                      {[
                        { id: 'banking', title: 'Banking Security Alert', desc: 'Suspicious activity detected on your account. Click to verify your identity.' },
                        { id: 'it-support', title: 'IT Support Request', desc: 'Your password will expire soon. Update your credentials to maintain access.' },
                        { id: 'delivery', title: 'Package Delivery', desc: 'We attempted to deliver your package. Click to reschedule delivery.' }
                      ].map(template => (
                        <div
                          key={template.id}
                          className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                            formData.template === template.id 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border hover:bg-muted/30'
                          }`}
                          onClick={() => setFormData(prev => ({ ...prev, template: template.id }))}
                          data-testid={`template-${template.id}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-sm">{template.title}</h4>
                            <div className={`w-4 h-4 rounded-full border-2 ${
                              formData.template === template.id 
                                ? 'border-primary bg-primary' 
                                : 'border-muted-foreground'
                            }`} />
                          </div>
                          <p className="text-xs text-muted-foreground">{template.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full"
                    data-testid="button-customize-template"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Customize Template (WYSIWYG)
                  </Button>
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
                        <Badge className={getStatusColor(campaign.status)}>
                          {campaign.status}
                        </Badge>
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
