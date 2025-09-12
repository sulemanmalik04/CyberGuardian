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
  FileText,
  UserPlus,
  Trash2,
  MoreVertical
} from 'lucide-react';
import { api, type User } from '@/lib/api';
import { Progress } from '@/components/ui/progress';
import UserEditDialog from './UserEditDialog';
import CSVImportDialog from './CSVImportDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('edit');
  const [csvImportDialogOpen, setCsvImportDialogOpen] = useState(false);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', currentUser?.clientId],
    queryFn: () => api.getUsers(currentUser?.clientId),
    enabled: !!currentUser
  });


  const deleteUserMutation = useMutation({
    mutationFn: api.deleteUser,
    onSuccess: () => {
      toast({
        title: 'User Deactivated',
        description: 'User has been deactivated successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to deactivate user',
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


  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setDialogMode('edit');
    setEditDialogOpen(true);
  };

  const handleCreateUser = () => {
    setSelectedUser(null);
    setDialogMode('create');
    setEditDialogOpen(true);
  };

  const handleDeleteUser = (userId: string) => {
    deleteUserMutation.mutate(userId);
  };

  const handleCloseDialog = () => {
    setEditDialogOpen(false);
    setSelectedUser(null);
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
          <Button 
            onClick={handleCreateUser}
            data-testid="button-create-user"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Create User
          </Button>
          <Button variant="outline" data-testid="button-azure-ad">
            <Computer className="w-4 h-4 mr-2" />
            Import from Azure AD
          </Button>
          <Button 
            onClick={() => setCsvImportDialogOpen(true)}
            data-testid="button-import-csv"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
        </div>
      </div>

      {/* Integration Section */}
      <Card>
        <CardHeader>
          <CardTitle>User Import Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-4 border border-border rounded-lg">
              <div className="flex items-center space-x-3">
                <Upload className="text-blue-600 text-xl" />
                <div>
                  <p className="font-medium">CSV Import</p>
                  <p className="text-sm text-muted-foreground">Bulk import users from CSV file</p>
                </div>
              </div>
              <Button 
                onClick={() => setCsvImportDialogOpen(true)}
                data-testid="button-launch-csv-import"
              >
                Import
              </Button>
            </div>
            
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
          </div>
        </CardContent>
      </Card>

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
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              data-testid={`button-user-actions-${user.id}`}
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => handleEditUser(user)}
                              data-testid={`menu-edit-user-${user.id}`}
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Edit User
                            </DropdownMenuItem>
                            <DropdownMenuItem data-testid={`menu-assign-course-${user.id}`}>
                              <GraduationCap className="w-4 h-4 mr-2" />
                              Assign Course
                            </DropdownMenuItem>
                            <DropdownMenuItem data-testid={`menu-send-phishing-${user.id}`}>
                              <Fish className="w-4 h-4 mr-2" />
                              Send Phishing Test
                            </DropdownMenuItem>
                            {user.id !== currentUser?.id && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem
                                    onSelect={(e) => e.preventDefault()}
                                    className="text-destructive focus:text-destructive"
                                    data-testid={`menu-delete-user-${user.id}`}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    {user.isActive ? 'Deactivate User' : 'Activate User'}
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      {user.isActive ? 'Deactivate User' : 'Activate User'}
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {user.isActive 
                                        ? `Are you sure you want to deactivate ${user.firstName} ${user.lastName}? They will no longer be able to access the system.`
                                        : `Are you sure you want to reactivate ${user.firstName} ${user.lastName}? They will regain access to the system.`
                                      }
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteUser(user.id)}
                                      className={user.isActive ? 'bg-destructive hover:bg-destructive/90' : 'bg-green-600 hover:bg-green-700'}
                                      data-testid={`confirm-delete-user-${user.id}`}
                                    >
                                      {user.isActive ? 'Deactivate' : 'Activate'}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      
      {/* User Edit Dialog */}
      <UserEditDialog
        user={selectedUser}
        isOpen={editDialogOpen}
        onClose={handleCloseDialog}
        mode={dialogMode}
      />
      
      {/* CSV Import Dialog */}
      <CSVImportDialog
        isOpen={csvImportDialogOpen}
        onClose={() => setCsvImportDialogOpen(false)}
      />
    </div>
  );
}
