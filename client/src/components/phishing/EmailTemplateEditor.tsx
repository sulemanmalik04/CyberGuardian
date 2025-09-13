import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Bold, 
  Italic, 
  Link, 
  List, 
  Type, 
  Image,
  Code,
  Eye,
  Copy,
  Variable,
  Palette,
  AlertCircle,
  Mail,
  User,
  Building,
  Calendar,
  Globe
} from 'lucide-react';

interface EmailTemplate {
  subject: string;
  fromName: string;
  fromEmail: string;
  htmlContent: string;
  textContent: string;
  domain: string;
}

interface EmailTemplateEditorProps {
  template: EmailTemplate;
  onChange: (template: EmailTemplate) => void;
  onPreview?: () => void;
}

const variableOptions = [
  { value: '{{firstName}}', label: 'First Name', icon: User },
  { value: '{{lastName}}', label: 'Last Name', icon: User },
  { value: '{{fullName}}', label: 'Full Name', icon: User },
  { value: '{{email}}', label: 'Email Address', icon: Mail },
  { value: '{{company}}', label: 'Company Name', icon: Building },
  { value: '{{department}}', label: 'Department', icon: Building },
  { value: '{{trackingUrl}}', label: 'Tracking Link', icon: Link },
  { value: '{{reportPhishingUrl}}', label: 'Report Phishing Link', icon: AlertCircle },
  { value: '{{currentDate}}', label: 'Current Date', icon: Calendar },
];

const colorSchemes = [
  { name: 'Professional Blue', primary: '#0078d4', secondary: '#f0f0f0' },
  { name: 'Corporate Gray', primary: '#333333', secondary: '#f8f8f8' },
  { name: 'Alert Red', primary: '#d73027', secondary: '#fff5f5' },
  { name: 'Success Green', primary: '#28a745', secondary: '#f0fff4' },
  { name: 'Warning Orange', primary: '#ff6600', secondary: '#fff9e6' },
];

export default function EmailTemplateEditor({ template, onChange, onPreview }: EmailTemplateEditorProps) {
  const [activeTab, setActiveTab] = useState('visual');
  const [selectedVariable, setSelectedVariable] = useState('');
  const [selectedColor, setSelectedColor] = useState(colorSchemes[0]);
  const [htmlPreview, setHtmlPreview] = useState('');

  // Generate HTML preview with proper styling
  const generateHtmlContent = () => {
    const baseStyles = `
      body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
      .container { max-width: 600px; margin: 0 auto; background-color: white; }
      .header { background-color: ${selectedColor.primary}; color: white; padding: 20px; text-align: center; }
      .content { padding: 30px; color: #333; line-height: 1.6; }
      .button { background-color: ${selectedColor.primary}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0; }
      .footer { background-color: ${selectedColor.secondary}; padding: 20px; font-size: 12px; color: #666; text-align: center; }
      .warning { color: #d73027; font-weight: bold; }
      .highlight { background-color: #fffae6; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; }
    `;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${template.fromName}</h1>
    </div>
    <div class="content">
      ${template.htmlContent || '<p>Start typing your email content here...</p>'}
    </div>
    <div class="footer">
      <p>This email was sent from ${template.fromEmail}</p>
      <p>&copy; 2024 ${template.fromName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
  };

  useEffect(() => {
    setHtmlPreview(generateHtmlContent());
  }, [template, selectedColor]);

  const insertVariable = (variable: string) => {
    const newContent = template.htmlContent + ' ' + variable;
    onChange({ ...template, htmlContent: newContent });
  };

  const insertHtmlElement = (tag: string, content: string = '') => {
    const element = content ? `<${tag}>${content}</${tag}>` : `<${tag}></${tag}>`;
    const newContent = template.htmlContent + '\n' + element;
    onChange({ ...template, htmlContent: newContent });
  };

  const applyFormatting = (format: string) => {
    switch (format) {
      case 'bold':
        insertHtmlElement('strong', 'Bold text');
        break;
      case 'italic':
        insertHtmlElement('em', 'Italic text');
        break;
      case 'link':
        onChange({ 
          ...template, 
          htmlContent: template.htmlContent + '\n<a href="{{trackingUrl}}" class="button">Click Here</a>' 
        });
        break;
      case 'list':
        insertHtmlElement('ul', '<li>Item 1</li>\n<li>Item 2</li>\n<li>Item 3</li>');
        break;
      case 'heading':
        insertHtmlElement('h2', 'Heading');
        break;
      case 'image':
        onChange({ 
          ...template, 
          htmlContent: template.htmlContent + '\n<img src="https://via.placeholder.com/600x200" alt="Image" style="width: 100%; height: auto;">' 
        });
        break;
    }
  };

  return (
    <div className="space-y-4">
      {/* Email Headers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Headers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="subject">Subject Line</Label>
              <Input
                id="subject"
                value={template.subject}
                onChange={(e) => onChange({ ...template, subject: e.target.value })}
                placeholder="Enter email subject..."
                data-testid="input-subject"
              />
            </div>
            <div>
              <Label htmlFor="fromName">From Name</Label>
              <Input
                id="fromName"
                value={template.fromName}
                onChange={(e) => onChange({ ...template, fromName: e.target.value })}
                placeholder="Sender name..."
                data-testid="input-from-name"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="fromEmail">From Email</Label>
              <Input
                id="fromEmail"
                type="email"
                value={template.fromEmail}
                onChange={(e) => onChange({ ...template, fromEmail: e.target.value })}
                placeholder="sender@domain.com"
                data-testid="input-from-email"
              />
            </div>
            <div>
              <Label htmlFor="domain">Phishing Domain</Label>
              <Input
                id="domain"
                value={template.domain}
                onChange={(e) => onChange({ ...template, domain: e.target.value })}
                placeholder="phishing-domain.com"
                data-testid="input-domain"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email Content Editor */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Type className="h-5 w-5" />
              Email Content
            </CardTitle>
            <div className="flex gap-2">
              {/* Formatting Toolbar */}
              <Button
                size="sm"
                variant="outline"
                onClick={() => applyFormatting('bold')}
                title="Bold"
                data-testid="button-bold"
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => applyFormatting('italic')}
                title="Italic"
                data-testid="button-italic"
              >
                <Italic className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => applyFormatting('link')}
                title="Insert Link"
                data-testid="button-link"
              >
                <Link className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => applyFormatting('list')}
                title="Insert List"
                data-testid="button-list"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => applyFormatting('heading')}
                title="Insert Heading"
                data-testid="button-heading"
              >
                <Type className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => applyFormatting('image')}
                title="Insert Image"
                data-testid="button-image"
              >
                <Image className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="visual">Visual Editor</TabsTrigger>
              <TabsTrigger value="html">HTML Code</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>

            <TabsContent value="visual" className="space-y-4">
              {/* Variable Insertion */}
              <div>
                <Label>Insert Variables</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {variableOptions.map((variable) => {
                    const Icon = variable.icon;
                    return (
                      <Button
                        key={variable.value}
                        size="sm"
                        variant="outline"
                        onClick={() => insertVariable(variable.value)}
                        data-testid={`button-var-${variable.value}`}
                      >
                        <Icon className="h-3 w-3 mr-1" />
                        {variable.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Color Scheme Selection */}
              <div>
                <Label>Color Scheme</Label>
                <div className="flex gap-2 mt-2">
                  {colorSchemes.map((scheme) => (
                    <Button
                      key={scheme.name}
                      size="sm"
                      variant={selectedColor.name === scheme.name ? 'default' : 'outline'}
                      onClick={() => setSelectedColor(scheme)}
                      data-testid={`button-color-${scheme.name}`}
                    >
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: scheme.primary }}
                        />
                        {scheme.name}
                      </div>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Content Editor */}
              <div>
                <Label htmlFor="htmlContent">Email Body (HTML)</Label>
                <Textarea
                  id="htmlContent"
                  value={template.htmlContent}
                  onChange={(e) => onChange({ ...template, htmlContent: e.target.value })}
                  placeholder="Enter your email content here. Use the toolbar above to format text and insert variables..."
                  className="min-h-[300px] font-mono text-sm"
                  data-testid="textarea-html-content"
                />
              </div>

              {/* Plain Text Version */}
              <div>
                <Label htmlFor="textContent">Plain Text Version</Label>
                <Textarea
                  id="textContent"
                  value={template.textContent}
                  onChange={(e) => onChange({ ...template, textContent: e.target.value })}
                  placeholder="Enter plain text version for email clients that don't support HTML..."
                  className="min-h-[150px]"
                  data-testid="textarea-text-content"
                />
              </div>
            </TabsContent>

            <TabsContent value="html">
              <div>
                <Label>Raw HTML Code</Label>
                <Textarea
                  value={htmlPreview}
                  onChange={(e) => onChange({ ...template, htmlContent: e.target.value })}
                  className="min-h-[500px] font-mono text-xs"
                  data-testid="textarea-raw-html"
                />
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigator.clipboard.writeText(htmlPreview)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy HTML
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="preview">
              <div>
                <Label>Email Preview</Label>
                <div className="border rounded-lg overflow-hidden mt-2">
                  <iframe
                    srcDoc={htmlPreview}
                    className="w-full h-[500px] bg-white"
                    title="Email Preview"
                    data-testid="iframe-preview"
                  />
                </div>
                {onPreview && (
                  <Button
                    className="mt-4"
                    onClick={onPreview}
                    data-testid="button-full-preview"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Full Screen Preview
                  </Button>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Tips Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Phishing Template Tips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Use urgency and fear tactics sparingly to make the simulation realistic</li>
            <li>• Include the {'{{trackingUrl}}'} variable for the main phishing link</li>
            <li>• Add {'{{reportPhishingUrl}}'} to allow users to report the email</li>
            <li>• Personalize with {'{{firstName}}'} and {'{{company}}'} for better engagement</li>
            <li>• Keep subject lines under 50 characters for mobile compatibility</li>
            <li>• Test your template with different email clients before launching</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}