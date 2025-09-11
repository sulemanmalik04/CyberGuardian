import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  RotateCcw
} from 'lucide-react';
import { api, type Client } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';

export default function SuperAdminDashboard() {
  const [searchTerm, setSearchTerm] = useState('');
  
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: api.getClients
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
        <Button data-testid="button-create-client">
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
                        <div className="flex items-center space-x-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            data-testid={`button-edit-client-${client.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            data-testid={`button-analytics-client-${client.id}`}
                          >
                            <BarChart3 className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            data-testid={`button-renew-client-${client.id}`}
                          >
                            <RotateCcw className="w-4 h-4" />
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
