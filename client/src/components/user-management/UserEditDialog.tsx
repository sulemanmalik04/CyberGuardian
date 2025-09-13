import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { api, type User } from '@/lib/api';
import { Loader2, Eye, EyeOff } from 'lucide-react';

const userEditSchema = z.object({
  email: z.string().email('Invalid email address'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  role: z.enum(['super_admin', 'client_admin', 'end_user']),
  department: z.string().optional(),
  language: z.string().min(1, 'Language is required'),
  isActive: z.boolean(),
  password: z.string().optional().refine((val) => !val || val.length >= 8, {
    message: 'Password must be at least 8 characters long if provided'
  })
});

type UserEditFormData = z.infer<typeof userEditSchema>;

interface UserEditDialogProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
}

export default function UserEditDialog({ user, isOpen, onClose, mode }: UserEditDialogProps) {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<UserEditFormData>({
    resolver: zodResolver(userEditSchema),
    defaultValues: {
      email: '',
      firstName: '',
      lastName: '',
      role: 'end_user',
      department: '',
      language: 'en',
      isActive: true,
      password: ''
    }
  });

  useEffect(() => {
    if (user && mode === 'edit') {
      form.reset({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role as any,
        department: user.department || '',
        language: user.language,
        isActive: user.isActive,
        password: ''
      });
    } else if (mode === 'create') {
      form.reset({
        email: '',
        firstName: '',
        lastName: '',
        role: 'end_user',
        department: '',
        language: 'en',
        isActive: true,
        password: ''
      });
    }
  }, [user, mode, form]);

  const createMutation = useMutation({
    mutationFn: (userData: UserEditFormData) => {
      return api.createUser({
        ...userData,
        // SECURITY FIX: Send 'password' field (plaintext) - backend will hash it properly
        // If no password provided, backend will generate a strong random password
        clientId: currentUser?.role === 'client_admin' ? currentUser.clientId : undefined
      } as any);
    },
    onSuccess: () => {
      toast({
        title: 'User Created',
        description: 'User has been created successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create user',
        variant: 'destructive'
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: (userData: UserEditFormData) => {
      if (!user) throw new Error('No user selected');
      // SECURITY FIX: Send 'password' field directly - backend will hash it properly
      // Only send password if it's provided and not empty
      const updateData: any = { ...userData };
      if (!updateData.password || !updateData.password.trim()) {
        delete updateData.password; // Don't send empty password to backend
      }
      return api.updateUser(user.id, updateData);
    },
    onSuccess: () => {
      toast({
        title: 'User Updated',
        description: 'User has been updated successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update user',
        variant: 'destructive'
      });
    }
  });

  const onSubmit = (data: UserEditFormData) => {
    if (mode === 'create') {
      createMutation.mutate(data);
    } else {
      updateMutation.mutate(data);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  const availableRoles = currentUser?.role === 'super_admin' 
    ? ['super_admin', 'client_admin', 'end_user'] 
    : ['client_admin', 'end_user'];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" data-testid="user-edit-dialog">
        <DialogHeader>
          <DialogTitle data-testid="dialog-title">
            {mode === 'create' ? 'Create New User' : `Edit ${user?.firstName} ${user?.lastName}`}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create' 
              ? 'Add a new user to the system. They will receive login credentials via email.'
              : 'Update user information. Leave password field empty to keep current password.'
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder="user@example.com"
                      data-testid="input-email"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="John"
                        data-testid="input-first-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Doe"
                        data-testid="input-last-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-role">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableRoles.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role === 'super_admin' ? 'Super Admin' : 
                           role === 'client_admin' ? 'Client Admin' : 'End User'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="department"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="IT, HR, Finance, etc."
                      data-testid="input-department"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="language"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Language *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-language">
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="de">German</SelectItem>
                      <SelectItem value="it">Italian</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {mode === 'create' ? 'Password (optional - default will be used)' : 'New Password (optional)'}
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        type={showPassword ? 'text' : 'password'}
                        placeholder={mode === 'create' ? 'Leave empty for TempPass123!' : 'Leave empty to keep current'}
                        data-testid="input-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                        data-testid="button-toggle-password"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active User</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      User can log in and access the system
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-is-active"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                data-testid="button-save"
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === 'create' ? 'Create User' : 'Update User'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}