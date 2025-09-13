import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Building, 
  Users, 
  Fish, 
  DollarSign,
  ArrowUp,
  ArrowDown,
  Plus,
  Search,
  Filter,
  Edit,
  BarChart3,
  RotateCcw,
  MoreHorizontal,
  Ban,
  Calendar as CalendarIcon,
  AlertTriangle
} from 'lucide-react';
import { api, type Client } from '@/lib/api';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import CreateClientDialog from './CreateClientDialog';

export default function SuperAdminDashboard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [createClientOpen, setCreateClientOpen] = useState(false);
  const [renewDialogOpen, setRenewDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [renewDate, setRenewDate] = useState<Date | undefined>(undefined);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: clients = [], isLoading, refetch } = useQuery({
    queryKey: ['clients'],
    queryFn: api.getClients
  });

  // License management mutations
  const suspendClientMutation = useMutation({
    mutationFn: (clientId: string) => api.suspendClient(clientId),
    onSuccess: (updatedClient) => {
      toast({
        title: 'Client Suspended',
        description: `${updatedClient.name} license has been suspended.`,
        variant: 'destructive',
      });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Suspend Client',
        description: error.message || 'An unexpected error occurred',
        variant: 'destructive',
      });
    },
  });

  const renewClientMutation = useMutation({
    mutationFn: ({ clientId, expirationDate }: { clientId: string; expirationDate: string }) => 
      api.renewClient(clientId, expirationDate),
    onSuccess: (updatedClient) => {
      toast({
        title: 'License Renewed',
        description: `${updatedClient.name} license has been renewed.`,
      });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setRenewDialogOpen(false);
      setSelectedClient(null);
      setRenewDate(undefined);
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Renew License',
        description: error.message || 'An unexpected error occurred',
        variant: 'destructive',
      });
    },
  });

  // Calculate platform stats
  const platformStats = {
    activeClients: clients.filter(c => c.licenseStatus === 'active').length,
    totalUsers: clients.reduce((sum, c) => sum + (c.maxUsers || 0), 0),
    activeCampaigns: 187, // This would come from campaign analytics
    revenue: 89420
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.subdomain.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'expired':
        return 'bg-red-100 text-red-800';
      case 'suspended':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold" data-testid="heading-platform-overview">
          Platform Overview
        </h1>
        <Button 
          onClick={() => setCreateClientOpen(true)}
          data-testid="button-create-client"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create New Client
        </Button>
      </div>

      {/* Platform Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Active Clients</p>
                <p className="text-2xl font-bold" data-testid="stat-active-clients">
                  {platformStats.activeClients}
                </p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Building className="text-primary text-xl" />
              </div>
            </div>
            <div className="flex items-center mt-4 text-sm">
              <ArrowUp className="text-green-500 w-4 h-4 mr-1" />
              <span className="text-green-500">+12%</span>
              <span className="text-muted-foreground ml-1">from last month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Total Users</p>
                <p className="text-2xl font-bold" data-testid="stat-total-users">
                  {platformStats.totalUsers.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                <Users className="text-accent text-xl" />
              </div>
            </div>
            <div className="flex items-center mt-4 text-sm">
              <ArrowUp className="text-green-500 w-4 h-4 mr-1" />
              <span className="text-green-500">+8%</span>
              <span className="text-muted-foreground ml-1">from last month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Campaigns Active</p>
                <p className="text-2xl font-bold" data-testid="stat-active-campaigns">
                  {platformStats.activeCampaigns}
                </p>
              </div>
              <div className="w-12 h-12 bg-destructive/10 rounded-lg flex items-center justify-center">
                <Fish className="text-destructive text-xl" />
              </div>
            </div>
            <div className="flex items-center mt-4 text-sm">
              <ArrowDown className="text-red-500 w-4 h-4 mr-1" />
              <span className="text-red-500">-3%</span>
              <span className="text-muted-foreground ml-1">from last month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Revenue (MRR)</p>
                <p className="text-2xl font-bold" data-testid="stat-revenue">
                  ${platformStats.revenue.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
                <DollarSign className="text-green-500 text-xl" />
              </div>
            </div>
            <div className="flex items-center mt-4 text-sm">
              <ArrowUp className="text-green-500 w-4 h-4 mr-1" />
              <span className="text-green-500">+15%</span>
              <span className="text-muted-foreground ml-1">from last month</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Client Management Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Client Sessions</CardTitle>
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search clients..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  data-testid="input-search-clients"
                />
              </div>
              <Button variant="outline" size="sm" data-testid="button-filter">
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-4 font-medium text-sm">Client</th>
                  <th className="text-left p-4 font-medium text-sm">Users</th>
                  <th className="text-left p-4 font-medium text-sm">License Status</th>
                  <th className="text-left p-4 font-medium text-sm">Expiration</th>
                  <th className="text-left p-4 font-medium text-sm">Created</th>
                  <th className="text-left p-4 font-medium text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No clients found
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((client: Client) => (
                    <tr key={client.id} className="border-t border-border hover:bg-muted/30">
                      <td className="p-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                            {client.branding?.logo ? (
                              <img 
                                src={client.branding.logo} 
                                alt={`${client.name} logo`}
                                className="w-8 h-8 object-contain"
                              />
                            ) : (
                              <span className="text-primary-foreground font-medium text-sm">
                                {client.name.substring(0, 2).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="font-medium" data-testid={`client-name-${client.id}`}>
                              {client.name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {client.subdomain}.cyberaware.com
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="font-medium">{client.maxUsers}</span>
                      </td>
                      <td className="p-4">
                        <Badge className={getStatusColor(client.licenseStatus)}>
                          {client.licenseStatus}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <span className="text-sm">
                          {formatDate(client.expirationDate)}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(client.createdAt), { addSuffix: true })}
                        </span>
                      </td>
                      <td className="p-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => {
                                // TODO: Implement edit client functionality
                                toast({
                                  title: 'Feature Coming Soon',
                                  description: 'Client editing will be available in the next update.',
                                });
                              }}
                              data-testid={`menu-edit-client-${client.id}`}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Client
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => {
                                // TODO: Implement analytics view
                                toast({
                                  title: 'Feature Coming Soon',
                                  description: 'Client analytics will be available in the next update.',
                                });
                              }}
                              data-testid={`menu-analytics-client-${client.id}`}
                            >
                              <BarChart3 className="mr-2 h-4 w-4" />
                              View Analytics
                            </DropdownMenuItem>
                            {client.licenseStatus !== 'suspended' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setSelectedClient(client);
                                    setRenewDate(client.expirationDate ? new Date(client.expirationDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));
                                    setRenewDialogOpen(true);
                                  }}
                                  data-testid={`menu-renew-client-${client.id}`}
                                >
                                  <RotateCcw className="mr-2 h-4 w-4" />
                                  Renew License
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => {
                                    if (window.confirm(`Are you sure you want to suspend ${client.name}'s license? This will immediately disable access for all users.`)) {
                                      suspendClientMutation.mutate(client.id);
                                    }
                                  }}
                                  className="text-red-600"
                                  data-testid={`menu-suspend-client-${client.id}`}
                                >
                                  <Ban className="mr-2 h-4 w-4" />
                                  Suspend License
                                </DropdownMenuItem>
                              </>
                            )}
                            {client.licenseStatus === 'suspended' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setSelectedClient(client);
                                    setRenewDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));
                                    setRenewDialogOpen(true);
                                  }}
                                  className="text-green-600"
                                  data-testid={`menu-reactivate-client-${client.id}`}
                                >
                                  <RotateCcw className="mr-2 h-4 w-4" />
                                  Reactivate License
                                </DropdownMenuItem>
                              </>
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

      {/* Create Client Dialog */}
      <CreateClientDialog 
        open={createClientOpen}
        onOpenChange={setCreateClientOpen}
      />
      
      {/* Renew License Dialog */}
      <Dialog open={renewDialogOpen} onOpenChange={setRenewDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Renew License</DialogTitle>
            <DialogDescription>
              {selectedClient?.licenseStatus === 'suspended' ? 
                `Reactivate and set new expiration date for ${selectedClient?.name}` :
                `Set new expiration date for ${selectedClient?.name}`
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">New Expiration Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !renewDate && 'text-muted-foreground'
                    )}
                    data-testid="button-select-renewal-date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {renewDate ? format(renewDate, 'PPP') : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={renewDate}
                    onSelect={setRenewDate}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            {selectedClient?.licenseStatus === 'suspended' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm text-yellow-800">
                    This will reactivate the suspended license and restore access for all users.
                  </span>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setRenewDialogOpen(false);
                setSelectedClient(null);
                setRenewDate(undefined);
              }}
              disabled={renewClientMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedClient && renewDate) {
                  renewClientMutation.mutate({
                    clientId: selectedClient.id,
                    expirationDate: renewDate.toISOString()
                  });
                }
              }}
              disabled={!selectedClient || !renewDate || renewClientMutation.isPending}
              data-testid="button-confirm-renewal"
            >
              {renewClientMutation.isPending ? 'Processing...' : 
               selectedClient?.licenseStatus === 'suspended' ? 'Reactivate' : 'Renew License'
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
