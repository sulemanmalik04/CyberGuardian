import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Upload, 
  Users, 
  Search, 
  Edit, 
  GraduationCap, 
  Fish,
  Computer,
  FileText
} from 'lucide-react';
import { api, type User } from '@/lib/api';
import { Progress } from '@/components/ui/progress';

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', currentUser?.clientId],
    queryFn: () => api.getUsers(currentUser?.clientId),
    enabled: !!currentUser
  });

  const importCSVMutation = useMutation({
    mutationFn: api.importUsersFromCSV,
    onSuccess: (data) => {
      toast({
        title: 'CSV Import Complete',
        description: `${data.created} users created. ${data.errors.length} errors.`,
        variant: data.errors.length > 0 ? 'destructive' : 'default'
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Import Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.department && user.department.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      importCSVMutation.mutate(file);
    }
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  const getRoleName = (role: string) => {
    switch (role) {
      case 'client_admin':
        return 'Admin';
      case 'end_user':
        return 'User';
      case 'super_admin':
        return 'Super Admin';
      default:
        return role;
    }
  };

  const formatLastLogin = (lastLoginAt?: string) => {
    if (!lastLoginAt) return 'Never';
    const date = new Date(lastLoginAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="h-64 bg-gray-200 rounded"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold" data-testid="heading-user-management">
          User Management
        </h2>
        <div className="flex items-center space-x-3">
          <Button variant="outline" data-testid="button-azure-ad">
            <Computer className="w-4 h-4 mr-2" />
            Import from Azure AD
          </Button>
          <Button 
            onClick={() => fileInputRef.current?.click()}
            data-testid="button-import-csv"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileUpload}
            data-testid="input-csv-file"
          />
        </div>
      </div>

      {/* Import Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>CSV Import</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div 
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              data-testid="csv-drop-zone"
            >
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-2">
                Drag & drop your CSV file here, or click to browse
              </p>
              <Button variant="outline" size="sm">
                <Upload className="w-4 h-4 mr-2" />
                Choose File
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-2">Required columns:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Email (required)</li>
                <li>First Name (required)</li>
                <li>Last Name (required)</li>
                <li>Department (optional)</li>
                <li>Role (optional)</li>
                <li>Language (optional)</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Azure Active Directory</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-border rounded-lg">
              <div className="flex items-center space-x-3">
                <Computer className="text-blue-600 text-xl" />
                <div>
                  <p className="font-medium">Azure AD Integration</p>
                  <p className="text-sm text-muted-foreground">Sync users from Active Directory</p>
                </div>
              </div>
              <Badge className="bg-green-100 text-green-800">
                Connected
              </Badge>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-2">Directory ID</label>
                <Input 
                  value="12345678-1234-1234-1234-123456789012" 
                  readOnly 
                  className="bg-muted"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Application ID</label>
                <Input 
                  value="87654321-4321-4321-4321-210987654321" 
                  readOnly 
                  className="bg-muted"
                />
              </div>
              <Button className="w-full" variant="secondary" data-testid="button-sync-azure">
                <Computer className="w-4 h-4 mr-2" />
                Sync Now
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Users className="w-5 h-5" />
              <span>Users ({filteredUsers.length})</span>
            </CardTitle>
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search users..."
                  className="pl-10 w-64"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  data-testid="input-search-users"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-32" data-testid="select-role-filter">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="client_admin">Admin</SelectItem>
                  <SelectItem value="end_user">User</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-4 font-medium text-sm">User</th>
                  <th className="text-left p-4 font-medium text-sm">Role</th>
                  <th className="text-left p-4 font-medium text-sm">Department</th>
                  <th className="text-left p-4 font-medium text-sm">Training Progress</th>
                  <th className="text-left p-4 font-medium text-sm">Last Login</th>
                  <th className="text-left p-4 font-medium text-sm">Status</th>
                  <th className="text-left p-4 font-medium text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      {searchTerm || roleFilter !== 'all' ? 'No users match your filters' : 'No users found'}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user: User) => (
                    <tr key={user.id} className="border-t border-border hover:bg-muted/30">
                      <td className="p-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                            <span className="text-primary-foreground font-medium text-sm">
                              {user.firstName[0]}{user.lastName[0]}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium" data-testid={`user-name-${user.id}`}>
                              {user.firstName} {user.lastName}
                            </p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-sm">{getRoleName(user.role)}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm">{user.department || 'N/A'}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-2 w-32">
                          <Progress value={75} className="flex-1 h-2" />
                          <span className="text-sm font-medium">75%</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground">
                          {formatLastLogin(user.lastLoginAt)}
                        </span>
                      </td>
                      <td className="p-4">
                        <Badge className={getStatusColor(user.isActive)}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            data-testid={`button-edit-user-${user.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            data-testid={`button-assign-course-${user.id}`}
                          >
                            <GraduationCap className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            data-testid={`button-send-phishing-${user.id}`}
                          >
                            <Fish className="w-4 h-4" />
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
