import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { 
  Upload, 
  Save, 
  Palette, 
  Eye, 
  Building,
  Monitor,
  Smartphone,
  Globe
} from 'lucide-react';
import { api, type Client } from '@/lib/api';

export default function BrandingCustomization() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const logoInputRef = useRef<HTMLInputElement>(null);
  
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [isUploading, setIsUploading] = useState(false);

  const { data: client, isLoading } = useQuery({
    queryKey: ['client', currentUser?.clientId],
    queryFn: async () => {
      if (!currentUser?.clientId) return null;
      const clients = await api.getClients();
      return clients.find(c => c.id === currentUser.clientId) || null;
    },
    enabled: !!currentUser?.clientId
  });

  const [brandingData, setBrandingData] = useState({
    companyName: '',
    subdomain: '',
    primaryColor: '#1e40af',
    secondaryColor: '#475569',
    accentColor: '#f97316',
    backgroundColor: '#f8fafc',
    emailFooter: '',
    supportEmail: '',
    customCss: '',
    darkModeEnabled: true,
    includeLogoInEmails: true,
    logo: ''
  });

  // Initialize form data when client loads
  useState(() => {
    if (client) {
      setBrandingData({
        companyName: client.branding?.companyName || client.name,
        subdomain: client.subdomain,
        primaryColor: client.branding?.primaryColor || '#1e40af',
        secondaryColor: client.branding?.secondaryColor || '#475569',
        accentColor: client.branding?.accentColor || '#f97316',
        backgroundColor: client.branding?.backgroundColor || '#f8fafc',
        emailFooter: client.branding?.emailFooter || '',
        supportEmail: client.branding?.supportEmail || '',
        customCss: client.branding?.customCss || '',
        darkModeEnabled: client.branding?.darkModeEnabled ?? true,
        includeLogoInEmails: true,
        logo: client.branding?.logo || ''
      });
    }
  });

  const updateClientMutation = useMutation({
    mutationFn: (updates: Partial<Client>) => 
      api.updateClient(currentUser!.clientId!, updates),
    onSuccess: () => {
      toast({
        title: 'Branding Updated',
        description: 'Your brand customization has been saved successfully.'
      });
      queryClient.invalidateQueries({ queryKey: ['client'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const uploadLogoMutation = useMutation({
    mutationFn: api.uploadLogo,
    onSuccess: (data) => {
      setBrandingData(prev => ({ ...prev, logo: data.logoUrl }));
      toast({
        title: 'Logo Uploaded',
        description: 'Your logo has been uploaded successfully.'
      });
      setIsUploading(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Upload Failed',
        description: error.message,
        variant: 'destructive'
      });
      setIsUploading(false);
    }
  });

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Invalid File Type',
        description: 'Please upload a JPEG, PNG, SVG, or WebP image.',
        variant: 'destructive'
      });
      return;
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'File Too Large',
        description: 'Please upload an image smaller than 2MB.',
        variant: 'destructive'
      });
      return;
    }

    setIsUploading(true);
    uploadLogoMutation.mutate(file);
  };

  const handleSave = () => {
    if (!currentUser?.clientId) return;

    const updatedBranding = {
      logo: brandingData.logo,
      companyName: brandingData.companyName,
      primaryColor: brandingData.primaryColor,
      secondaryColor: brandingData.secondaryColor,
      accentColor: brandingData.accentColor,
      backgroundColor: brandingData.backgroundColor,
      emailFooter: brandingData.emailFooter,
      supportEmail: brandingData.supportEmail,
      customCss: brandingData.customCss,
      darkModeEnabled: brandingData.darkModeEnabled
    };

    updateClientMutation.mutate({
      name: brandingData.companyName,
      subdomain: brandingData.subdomain,
      branding: updatedBranding
    });
  };

  const handleColorChange = (colorType: string, value: string) => {
    setBrandingData(prev => ({ ...prev, [colorType]: value }));
    
    // Apply live preview
    document.documentElement.style.setProperty(
      `--${colorType.replace(/([A-Z])/g, '-$1').toLowerCase()}`, 
      value
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="h-64 bg-gray-200 rounded"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
            <div className="h-96 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold" data-testid="heading-branding-customization">
          Branding & Customization
        </h2>
        <Button 
          onClick={handleSave}
          disabled={updateClientMutation.isPending}
          data-testid="button-save-branding"
        >
          {updateClientMutation.isPending ? (
            <>
              <div className="loading-spinner w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full mr-2"></div>
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Configuration Section */}
        <div className="space-y-6">
          {/* Logo and Visual Identity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Building className="w-5 h-5" />
                <span>Logo & Visual Identity</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="logo-upload">Company Logo</Label>
                <div 
                  className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => logoInputRef.current?.click()}
                  data-testid="logo-upload-area"
                >
                  {brandingData.logo ? (
                    <div className="space-y-4">
                      <img 
                        src={brandingData.logo} 
                        alt="Company Logo" 
                        className="w-20 h-20 object-contain mx-auto"
                      />
                      <p className="text-sm text-muted-foreground">
                        Click to change logo
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="w-20 h-20 bg-primary rounded-lg mx-auto flex items-center justify-center">
                        <Building className="w-8 h-8 text-primary-foreground" />
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-2">Upload your company logo</p>
                        <Button variant="outline" size="sm" disabled={isUploading}>
                          {isUploading ? (
                            <>
                              <div className="loading-spinner w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2"></div>
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4 mr-2" />
                              Choose Logo
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                  data-testid="input-logo-upload"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Recommended: 200x200px, PNG or SVG, max 2MB
                </p>
              </div>
              
              <div>
                <Label htmlFor="company-name">Company Name</Label>
                <Input
                  id="company-name"
                  value={brandingData.companyName}
                  onChange={(e) => setBrandingData(prev => ({ ...prev, companyName: e.target.value }))}
                  placeholder="Your Company Name"
                  data-testid="input-company-name"
                />
              </div>

              <div>
                <Label htmlFor="subdomain">Portal Subdomain</Label>
                <div className="flex">
                  <Input
                    id="subdomain"
                    value={brandingData.subdomain}
                    onChange={(e) => setBrandingData(prev => ({ ...prev, subdomain: e.target.value }))}
                    className="rounded-r-none"
                    placeholder="company"
                    data-testid="input-subdomain"
                  />
                  <div className="px-3 py-2 bg-muted border border-l-0 border-input rounded-r-md text-muted-foreground text-sm flex items-center">
                    .cyberaware.com
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Color Scheme */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Palette className="w-5 h-5" />
                <span>Color Scheme</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="primary-color">Primary Color</Label>
                  <div className="flex items-center space-x-3 mt-2">
                    <input
                      type="color"
                      value={brandingData.primaryColor}
                      onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                      className="w-12 h-10 border border-input rounded-md cursor-pointer"
                      data-testid="input-primary-color"
                    />
                    <Input
                      value={brandingData.primaryColor}
                      onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                      className="flex-1 text-sm font-mono"
                      data-testid="input-primary-color-hex"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="secondary-color">Secondary Color</Label>
                  <div className="flex items-center space-x-3 mt-2">
                    <input
                      type="color"
                      value={brandingData.secondaryColor}
                      onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                      className="w-12 h-10 border border-input rounded-md cursor-pointer"
                      data-testid="input-secondary-color"
                    />
                    <Input
                      value={brandingData.secondaryColor}
                      onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                      className="flex-1 text-sm font-mono"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="accent-color">Accent Color</Label>
                  <div className="flex items-center space-x-3 mt-2">
                    <input
                      type="color"
                      value={brandingData.accentColor}
                      onChange={(e) => handleColorChange('accentColor', e.target.value)}
                      className="w-12 h-10 border border-input rounded-md cursor-pointer"
                      data-testid="input-accent-color"
                    />
                    <Input
                      value={brandingData.accentColor}
                      onChange={(e) => handleColorChange('accentColor', e.target.value)}
                      className="flex-1 text-sm font-mono"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="background-color">Background</Label>
                  <div className="flex items-center space-x-3 mt-2">
                    <input
                      type="color"
                      value={brandingData.backgroundColor}
                      onChange={(e) => handleColorChange('backgroundColor', e.target.value)}
                      className="w-12 h-10 border border-input rounded-md cursor-pointer"
                      data-testid="input-background-color"
                    />
                    <Input
                      value={brandingData.backgroundColor}
                      onChange={(e) => handleColorChange('backgroundColor', e.target.value)}
                      className="flex-1 text-sm font-mono"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Email Templates */}
          <Card>
            <CardHeader>
              <CardTitle>Email Templates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="email-footer">Email Footer Text</Label>
                <Textarea
                  id="email-footer"
                  value={brandingData.emailFooter}
                  onChange={(e) => setBrandingData(prev => ({ ...prev, emailFooter: e.target.value }))}
                  placeholder="© 2024 Your Company. All rights reserved.&#10;This email was sent from your cybersecurity training platform."
                  rows={3}
                  data-testid="textarea-email-footer"
                />
              </div>
              
              <div>
                <Label htmlFor="support-email">Support Contact</Label>
                <Input
                  id="support-email"
                  type="email"
                  value={brandingData.supportEmail}
                  onChange={(e) => setBrandingData(prev => ({ ...prev, supportEmail: e.target.value }))}
                  placeholder="support@yourcompany.com"
                  data-testid="input-support-email"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Include Company Logo in Emails</Label>
                  <p className="text-sm text-muted-foreground">Add your logo to email headers</p>
                </div>
                <Switch
                  checked={brandingData.includeLogoInEmails}
                  onCheckedChange={(checked) => 
                    setBrandingData(prev => ({ ...prev, includeLogoInEmails: checked }))
                  }
                  data-testid="switch-logo-in-emails"
                />
              </div>
            </CardContent>
          </Card>

          {/* Advanced Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Dark Mode Support</Label>
                  <p className="text-sm text-muted-foreground">Enable dark theme for user interface</p>
                </div>
                <Switch
                  checked={brandingData.darkModeEnabled}
                  onCheckedChange={(checked) => 
                    setBrandingData(prev => ({ ...prev, darkModeEnabled: checked }))
                  }
                  data-testid="switch-dark-mode"
                />
              </div>

              <div>
                <Label htmlFor="custom-css">Custom CSS (Advanced)</Label>
                <Textarea
                  id="custom-css"
                  value={brandingData.customCss}
                  onChange={(e) => setBrandingData(prev => ({ ...prev, customCss: e.target.value }))}
                  placeholder="/* Custom CSS styles */&#10;.custom-header {&#10;  background: linear-gradient(to right, #primary, #secondary);&#10;}"
                  rows={6}
                  className="font-mono text-sm"
                  data-testid="textarea-custom-css"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Add custom CSS to override default styles. Use with caution.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview Section */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <Eye className="w-5 h-5" />
                  <span>Live Preview</span>
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <Button
                    variant={previewMode === 'desktop' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPreviewMode('desktop')}
                    data-testid="button-desktop-preview"
                  >
                    <Monitor className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={previewMode === 'mobile' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPreviewMode('mobile')}
                    data-testid="button-mobile-preview"
                  >
                    <Smartphone className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className={`branding-preview border border-border rounded-lg overflow-hidden transition-all ${
                previewMode === 'mobile' ? 'max-w-sm mx-auto' : ''
              }`}>
                {/* Preview Header */}
                <div 
                  className="p-4 text-white"
                  style={{ backgroundColor: brandingData.primaryColor }}
                >
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-8 h-8 rounded flex items-center justify-center"
                      style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
                    >
                      {brandingData.logo ? (
                        <img 
                          src={brandingData.logo} 
                          alt="Logo" 
                          className="w-6 h-6 object-contain"
                        />
                      ) : (
                        <Building className="w-4 h-4" />
                      )}
                    </div>
                    <span className="font-semibold" data-testid="preview-company-name">
                      {brandingData.companyName || 'Your Company'}
                    </span>
                  </div>
                </div>
                
                {/* Preview Content */}
                <div 
                  className="p-6"
                  style={{ backgroundColor: brandingData.backgroundColor }}
                >
                  <h4 className="text-lg font-semibold mb-4">Welcome to Your Security Training Portal</h4>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: brandingData.primaryColor }}
                      ></div>
                      <span className="text-sm">Complete your assigned training courses</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: brandingData.accentColor }}
                      ></div>
                      <span className="text-sm">Take interactive security quizzes</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: brandingData.secondaryColor }}
                      ></div>
                      <span className="text-sm">Track your learning progress</span>
                    </div>
                  </div>
                  <button 
                    className="mt-4 px-4 py-2 rounded-md text-sm text-white"
                    style={{ backgroundColor: brandingData.primaryColor }}
                  >
                    Get Started
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* URL Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Globe className="w-5 h-5" />
                <span>Portal URL</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Your branded portal will be available at:</p>
                <p className="font-mono text-lg" data-testid="preview-portal-url">
                  https://{brandingData.subdomain || 'company'}.cyberaware.com
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Email Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Email Template Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border border-border rounded-lg overflow-hidden">
                <div 
                  className="p-4 text-white"
                  style={{ backgroundColor: brandingData.primaryColor }}
                >
                  <div className="flex items-center space-x-2">
                    {brandingData.logo && (
                      <img 
                        src={brandingData.logo} 
                        alt="Logo" 
                        className="w-6 h-6 object-contain"
                      />
                    )}
                    <span className="font-medium">{brandingData.companyName}</span>
                  </div>
                </div>
                <div className="p-4 bg-white">
                  <h4 className="font-semibold mb-2">New Training Assignment</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    You have been assigned a new cybersecurity training course.
                  </p>
                  <button 
                    className="px-4 py-2 rounded text-sm text-white"
                    style={{ backgroundColor: brandingData.accentColor }}
                  >
                    Start Training
                  </button>
                </div>
                {brandingData.emailFooter && (
                  <div className="p-3 bg-gray-50 border-t text-xs text-gray-500">
                    {brandingData.emailFooter}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
