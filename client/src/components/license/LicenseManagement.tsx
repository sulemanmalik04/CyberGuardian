import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  CheckCircle, 
  AlertTriangle, 
  Users, 
  DollarSign, 
  Plus,
  RotateCcw,
  Edit,
  Receipt,
  Calendar,
  TrendingUp,
  Building
} from 'lucide-react';
import { api, type Client } from '@/lib/api';
import { format, formatDistanceToNow, addDays, addMonths, addYears } from 'date-fns';

export default function LicenseManagement() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: api.getClients,
    enabled: currentUser?.role === 'super_admin'
  });

  const renewLicenseMutation = useMutation({
    mutationFn: async ({ clientId, duration }: { clientId: string; duration: string }) => {
      const client = clients.find(c => c.id === clientId);
      if (!client) throw new Error('Client not found');

      const currentExpiration = client.expirationDate ? new Date(client.expirationDate) : new Date();
      let newExpiration: Date;

      switch (duration) {
        case '1month':
          newExpiration = addMonths(currentExpiration, 1);
          break;
        case '3months':
          newExpiration = addMonths(currentExpiration, 3);
          break;
        case '6months':
          newExpiration = addMonths(currentExpiration, 6);
          break;
        case '1year':
          newExpiration = addYears(currentExpiration, 1);
          break;
        default:
          newExpiration = addMonths(currentExpiration, 1);
      }

      return api.updateClient(clientId, {
        expirationDate: newExpiration.toISOString(),
        licenseStatus: 'active'
      });
    },
    onSuccess: (_, variables) => {
      toast({
        title: 'License Renewed',
        description: `License has been successfully renewed for ${variables.duration}.`
      });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Renewal Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Calculate license stats
  const stats = {
    activeLicenses: clients.filter(c => c.licenseStatus === 'active').length,
    expiringSoon: clients.filter(c => {
      if (!c.expirationDate) return false;
      const expDate = new Date(c.expirationDate);
      const now = new Date();
      const daysUntilExpiry = (expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
    }).length,
    totalUsers: clients.reduce((sum, c) => sum + (c.maxUsers || 0), 0),
    monthlyRevenue: calculateMonthlyRevenue()
  };

  function calculateMonthlyRevenue() {
    // Calculate based on active licenses and user counts
    // This is a simplified calculation - real implementation would use actual pricing
    const activeClients = clients.filter(c => c.licenseStatus === 'active');
    const basePrice = 5; // $5 per user per month
    return activeClients.reduce((sum, client) => sum + (client.maxUsers * basePrice), 0);
  }

  const filteredClients = clients.filter(client => {
    if (statusFilter === 'all') return true;
    return client.licenseStatus === statusFilter;
  });

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

  const getExpirationStatus = (expirationDate?: string) => {
    if (!expirationDate) return { status: 'unknown', color: 'text-gray-500', days: null };
    
    const expDate = new Date(expirationDate);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) {
      return { status: 'expired', color: 'text-red-600', days: Math.abs(daysUntilExpiry) };
    } else if (daysUntilExpiry <= 7) {
      return { status: 'critical', color: 'text-red-600', days: daysUntilExpiry };
    } else if (daysUntilExpiry <= 30) {
      return { status: 'warning', color: 'text-yellow-600', days: daysUntilExpiry };
    } else {
      return { status: 'safe', color: 'text-green-600', days: daysUntilExpiry };
    }
  };

  const getPlanDetails = (maxUsers: number) => {
    if (maxUsers <= 50) return { name: 'Starter', features: 'Basic features + Email Support' };
    if (maxUsers <= 200) return { name: 'Professional', features: 'All features + Phone Support' };
    if (maxUsers <= 1000) return { name: 'Enterprise', features: 'Full features + AI + Analytics' };
    return { name: 'Enterprise Plus', features: 'Full features + Premium Support' };
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return format(new Date(dateString), 'MMM dd, yyyy');
  };

  const calculateMonthlyCost = (maxUsers: number) => {
    const plan = getPlanDetails(maxUsers);
    const basePricePerUser = plan.name === 'Starter' ? 3 : plan.name === 'Professional' ? 5 : 8;
    return maxUsers * basePricePerUser;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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

  if (currentUser?.role !== 'super_admin') {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Access Restricted</h3>
          <p className="text-muted-foreground">
            License management is only available to Super Administrators.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold" data-testid="heading-license-management">
          License Management
        </h2>
        <Button data-testid="button-add-license">
          <Plus className="w-4 h-4 mr-2" />
          Add License
        </Button>
      </div>

      {/* License Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Active Licenses</p>
                <p className="text-2xl font-bold" data-testid="stat-active-licenses">
                  {stats.activeLicenses}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="text-green-600 text-xl" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              {((stats.activeLicenses / clients.length) * 100).toFixed(1)}% of total licenses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Expiring Soon</p>
                <p className="text-2xl font-bold text-amber-600" data-testid="stat-expiring-soon">
                  {stats.expiringSoon}
                </p>
              </div>
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="text-amber-600 text-xl" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Within the next 30 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Total Users</p>
                <p className="text-2xl font-bold" data-testid="stat-total-users">
                  {stats.totalUsers.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Users className="text-primary text-xl" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Across all active licenses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Monthly Revenue</p>
                <p className="text-2xl font-bold text-green-600" data-testid="stat-monthly-revenue">
                  ${stats.monthlyRevenue.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <DollarSign className="text-green-600 text-xl" />
              </div>
            </div>
            <div className="flex items-center mt-4 text-sm">
              <TrendingUp className="text-green-500 w-4 h-4 mr-1" />
              <span className="text-green-500">+12%</span>
              <span className="text-muted-foreground ml-1">from last month</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* License Details Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>License Details</CardTitle>
            <div className="flex items-center space-x-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40" data-testid="select-status-filter">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" data-testid="button-auto-renewal">
                <RotateCcw className="w-4 h-4 mr-2" />
                Auto-Renewal Settings
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
                  <th className="text-left p-4 font-medium text-sm">Plan</th>
                  <th className="text-left p-4 font-medium text-sm">Users</th>
                  <th className="text-left p-4 font-medium text-sm">Monthly Cost</th>
                  <th className="text-left p-4 font-medium text-sm">Start Date</th>
                  <th className="text-left p-4 font-medium text-sm">Expiration</th>
                  <th className="text-left p-4 font-medium text-sm">Status</th>
                  <th className="text-left p-4 font-medium text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      {statusFilter !== 'all' ? `No ${statusFilter} licenses found` : 'No licenses found'}
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((client: Client) => {
                    const plan = getPlanDetails(client.maxUsers);
                    const expiration = getExpirationStatus(client.expirationDate);
                    const monthlyCost = calculateMonthlyCost(client.maxUsers);

                    return (
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
                                <Building className="w-5 h-5 text-primary-foreground" />
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
                          <div>
                            <span className="font-medium">{plan.name}</span>
                            <p className="text-sm text-muted-foreground">{plan.features}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="font-medium">{client.maxUsers}</span>
                        </td>
                        <td className="p-4">
                          <span className="font-medium">${monthlyCost.toLocaleString()}</span>
                        </td>
                        <td className="p-4">
                          <span className="text-sm">
                            {formatDate(client.createdAt)}
                          </span>
                        </td>
                        <td className="p-4">
                          <div>
                            <span className="text-sm">
                              {formatDate(client.expirationDate)}
                            </span>
                            {expiration.days !== null && (
                              <p className={`text-xs ${expiration.color} font-medium`}>
                                {expiration.status === 'expired' 
                                  ? `Expired ${expiration.days} days ago`
                                  : `${expiration.days} days remaining`
                                }
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge className={getStatusColor(client.licenseStatus)}>
                            {client.licenseStatus}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => renewLicenseMutation.mutate({ 
                                clientId: client.id, 
                                duration: '1year' 
                              })}
                              disabled={renewLicenseMutation.isPending}
                              data-testid={`button-renew-${client.id}`}
                            >
                              <RotateCcw className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              data-testid={`button-edit-${client.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              data-testid={`button-billing-${client.id}`}
                            >
                              <Receipt className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Renewal Actions */}
      {stats.expiringSoon > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
                <div>
                  <h3 className="font-semibold text-amber-900">
                    {stats.expiringSoon} License{stats.expiringSoon > 1 ? 's' : ''} Expiring Soon
                  </h3>
                  <p className="text-sm text-amber-700">
                    Take action to prevent service interruption for your clients
                  </p>
                </div>
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" data-testid="button-bulk-renew">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Bulk Renew
                </Button>
                <Button size="sm" data-testid="button-contact-clients">
                  <Calendar className="w-4 h-4 mr-2" />
                  Contact Clients
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
