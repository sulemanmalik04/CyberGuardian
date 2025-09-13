import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2, Upload, X, Palette } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

const createClientSchema = z.object({
  name: z.string().min(2, 'Company name must be at least 2 characters'),
  subdomain: z.string()
    .min(2, 'Subdomain must be at least 2 characters')
    .max(20, 'Subdomain must be no more than 20 characters')
    .regex(/^[a-z0-9-]+$/, 'Subdomain can only contain lowercase letters, numbers, and hyphens')
    .refine(val => !val.startsWith('-') && !val.endsWith('-'), 'Subdomain cannot start or end with a hyphen'),
  licenseStatus: z.enum(['active', 'expired', 'suspended']),
  maxUsers: z.number().min(1, 'Must allow at least 1 user').max(10000, 'Maximum 10,000 users allowed'),
  expirationDate: z.date().optional(),
  adminEmail: z.string().email('Please enter a valid email address'),
  adminFirstName: z.string().min(1, 'First name is required'),
  adminLastName: z.string().min(1, 'Last name is required'),
  adminPassword: z.string().min(8, 'Password must be at least 8 characters'),
  primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i, 'Primary color must be a valid hex color'),
  secondaryColor: z.string().regex(/^#[0-9A-F]{6}$/i, 'Secondary color must be a valid hex color'),
  accentColor: z.string().regex(/^#[0-9A-F]{6}$/i, 'Accent color must be a valid hex color'),
  backgroundColor: z.string().regex(/^#[0-9A-F]{6}$/i, 'Background color must be a valid hex color'),
});

type CreateClientForm = z.infer<typeof createClientSchema>;

interface CreateClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateClientDialog({ open, onOpenChange }: CreateClientDialogProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [subdomainChecking, setSubdomainChecking] = useState(false);
  const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<CreateClientForm>({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      name: '',
      subdomain: '',
      licenseStatus: 'active',
      maxUsers: 100,
      adminEmail: '',
      adminFirstName: '',
      adminLastName: '',
      adminPassword: '',
      primaryColor: '#1e40af',
      secondaryColor: '#3b82f6',
      accentColor: '#60a5fa',
      backgroundColor: '#f8fafc',
    },
  });

  const createClientMutation = useMutation({
    mutationFn: async (data: CreateClientForm) => {
      let logoUrl = null;
      
      // Upload logo if provided
      if (logoFile) {
        logoUrl = await api.uploadLogo(logoFile);
      }

      // Create client with atomic endpoint that handles both client and admin creation
      const result = await api.createClientWithAdmin({
        client: {
          name: data.name,
          subdomain: data.subdomain,
          licenseStatus: data.licenseStatus,
          maxUsers: data.maxUsers,
          expirationDate: data.expirationDate?.toISOString(),
          branding: {
            companyName: data.name,
            primaryColor: data.primaryColor,
            secondaryColor: data.secondaryColor,
            accentColor: data.accentColor,
            backgroundColor: data.backgroundColor,
            logo: logoUrl || undefined,
            darkModeEnabled: true,
          },
        },
        admin: {
          email: data.adminEmail,
          firstName: data.adminFirstName,
          lastName: data.adminLastName,
          password: data.adminPassword,
        }
      });

      return result;
    },
    onSuccess: ({ client, admin }) => {
      toast({
        title: 'Client Created Successfully',
        description: `${client.name} has been created with admin user ${admin.email}`,
      });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      onOpenChange(false);
      form.reset();
      setLogoFile(null);
      setLogoPreview(null);
      setSubdomainAvailable(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Create Client',
        description: error.message || 'An unexpected error occurred',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = async (data: CreateClientForm) => {
    setIsCreating(true);
    try {
      await createClientMutation.mutateAsync(data);
    } finally {
      setIsCreating(false);
    }
  };

  // Auto-generate subdomain from company name
  const handleNameChange = (name: string) => {
    const subdomain = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .substring(0, 20); // Limit length
    
    form.setValue('subdomain', subdomain);
    
    // Check subdomain availability when auto-generated
    if (subdomain.length >= 2) {
      checkSubdomainAvailability(subdomain);
    } else {
      setSubdomainAvailable(null);
    }
  };

  // Check subdomain availability with debouncing
  const checkSubdomainAvailability = async (subdomain: string) => {
    if (subdomain.length < 2 || !/^[a-z0-9-]+$/.test(subdomain)) {
      setSubdomainAvailable(null);
      return;
    }

    setSubdomainChecking(true);
    
    try {
      const result = await api.checkSubdomainAvailability(subdomain);
      setSubdomainAvailable(result.available);
    } catch (error) {
      console.error('Failed to check subdomain availability:', error);
      setSubdomainAvailable(null);
    } finally {
      setSubdomainChecking(false);
    }
  };

  // Handle manual subdomain changes
  const handleSubdomainChange = (subdomain: string) => {
    // Clear availability status immediately when typing
    setSubdomainAvailable(null);
    
    // Only check if the subdomain meets basic requirements
    if (subdomain.length >= 2 && /^[a-z0-9-]+$/.test(subdomain)) {
      // Debounce the check
      const timeoutId = setTimeout(() => {
        checkSubdomainAvailability(subdomain);
      }, 500);
      
      return () => clearTimeout(timeoutId);
    }
  };

  // Handle logo file selection
  const handleLogoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Invalid File Type',
        description: 'Please select a JPEG, PNG, SVG, or WebP image file.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (2MB limit)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'File Too Large',
        description: 'Logo file must be smaller than 2MB.',
        variant: 'destructive',
      });
      return;
    }

    setLogoFile(file);
    
    // Create preview URL
    const reader = new FileReader();
    reader.onload = (e) => {
      setLogoPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Remove selected logo
  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Client</DialogTitle>
          <DialogDescription>
            Create a new client organization with its own admin user and branded portal.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Company Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Company Information</h3>
              
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Acme Corporation"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          handleNameChange(e.target.value);
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      The display name for this client organization
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="subdomain"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subdomain</FormLabel>
                    <FormControl>
                      <div className="flex relative">
                        <Input
                          placeholder="acme"
                          {...field}
                          className={cn(
                            "rounded-r-none pr-10",
                            subdomainAvailable === false && "border-red-500",
                            subdomainAvailable === true && "border-green-500"
                          )}
                          onChange={(e) => {
                            field.onChange(e);
                            handleSubdomainChange(e.target.value);
                          }}
                          data-testid="input-subdomain"
                        />
                        <div className="absolute right-12 top-1/2 transform -translate-y-1/2">
                          {subdomainChecking ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : subdomainAvailable === true ? (
                            <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center">
                              <span className="text-white text-xs font-bold">✓</span>
                            </div>
                          ) : subdomainAvailable === false ? (
                            <div className="h-4 w-4 rounded-full bg-red-500 flex items-center justify-center">
                              <span className="text-white text-xs font-bold">×</span>
                            </div>
                          ) : null}
                        </div>
                        <div className="px-3 py-2 bg-muted border border-l-0 border-input rounded-r-md text-muted-foreground text-sm flex items-center">
                          .cyberaware.com
                        </div>
                      </div>
                    </FormControl>
                    <FormDescription>
                      {subdomainAvailable === false ? (
                        <span className="text-red-500">This subdomain is already taken</span>
                      ) : subdomainAvailable === true ? (
                        <span className="text-green-500">This subdomain is available</span>
                      ) : (
                        "Unique subdomain for the client portal (lowercase, numbers, hyphens only)"
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="licenseStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>License Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="expired">Expired</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="maxUsers"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maximum Users</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="100"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="expirationDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>License Expiration Date (Optional)</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? (
                              format(field.value, 'PPP')
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date < new Date() || date < new Date('1900-01-01')
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormDescription>
                      When this client's license expires (leave empty for no expiration)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Branding Configuration */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Branding Configuration</h3>
              
              {/* Logo Upload */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Company Logo</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                  {logoPreview ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <img 
                          src={logoPreview} 
                          alt="Logo preview" 
                          className="h-16 w-16 object-contain"
                        />
                        <div>
                          <p className="text-sm font-medium">{logoFile?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {logoFile && (logoFile.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={removeLogo}
                        data-testid="button-remove-logo"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Upload className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="mt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          data-testid="button-upload-logo"
                        >
                          Select Logo File
                        </Button>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        PNG, JPG, SVG, or WebP up to 2MB
                      </p>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoSelect}
                    className="hidden"
                    data-testid="input-logo-file"
                  />
                </div>
              </div>

              {/* Color Pickers */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="primaryColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Color</FormLabel>
                      <FormControl>
                        <div className="flex space-x-2">
                          <Input
                            type="color"
                            {...field}
                            className="w-12 h-10 p-1 border rounded cursor-pointer"
                            data-testid="input-primary-color"
                          />
                          <Input
                            type="text"
                            {...field}
                            placeholder="#1e40af"
                            className="flex-1"
                            data-testid="input-primary-color-hex"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="secondaryColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Secondary Color</FormLabel>
                      <FormControl>
                        <div className="flex space-x-2">
                          <Input
                            type="color"
                            {...field}
                            className="w-12 h-10 p-1 border rounded cursor-pointer"
                            data-testid="input-secondary-color"
                          />
                          <Input
                            type="text"
                            {...field}
                            placeholder="#3b82f6"
                            className="flex-1"
                            data-testid="input-secondary-color-hex"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="accentColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Accent Color</FormLabel>
                      <FormControl>
                        <div className="flex space-x-2">
                          <Input
                            type="color"
                            {...field}
                            className="w-12 h-10 p-1 border rounded cursor-pointer"
                            data-testid="input-accent-color"
                          />
                          <Input
                            type="text"
                            {...field}
                            placeholder="#60a5fa"
                            className="flex-1"
                            data-testid="input-accent-color-hex"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="backgroundColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Background Color</FormLabel>
                      <FormControl>
                        <div className="flex space-x-2">
                          <Input
                            type="color"
                            {...field}
                            className="w-12 h-10 p-1 border rounded cursor-pointer"
                            data-testid="input-background-color"
                          />
                          <Input
                            type="text"
                            {...field}
                            placeholder="#f8fafc"
                            className="flex-1"
                            data-testid="input-background-color-hex"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Admin User Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Client Administrator</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="adminFirstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="adminLastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="adminEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="admin@company.com"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      This will be the login email for the client administrator
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="adminPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Temporary Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Minimum 8 characters"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      The admin user will be prompted to change this on first login
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating} data-testid="button-create-client">
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Client
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}