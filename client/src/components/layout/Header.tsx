import { Bell, Menu, MessageCircle, ChevronDown, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface HeaderProps {
  onSidebarToggle: () => void;
  onChatToggle: () => void;
}

export default function Header({ onSidebarToggle, onChatToggle }: HeaderProps) {
  const { user, logout } = useAuth();

  // Fetch client branding if user has clientId
  const { data: client } = useQuery({
    queryKey: ['client', user?.clientId],
    queryFn: async () => {
      if (!user?.clientId) return null;
      const clients = await api.getClients();
      return clients.find(c => c.id === user.clientId) || null;
    },
    enabled: !!user?.clientId && user.role !== 'super_admin'
  });

  const brandName = client?.branding?.companyName || client?.name || 'CyberAware Pro';
  const primaryColor = client?.branding?.primaryColor || '#1e40af';
  const logoUrl = client?.branding?.logo;

  const getUserInitials = () => {
    if (!user) return 'U';
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  };

  const getRoleDisplay = () => {
    switch (user?.role) {
      case 'super_admin':
        return 'Super Admin';
      case 'client_admin':
        return 'Admin';
      case 'end_user':
        return 'User';
      default:
        return 'User';
    }
  };

  return (
    <header className="bg-card border-b border-border sticky top-0 z-50">
      <div className="flex items-center justify-between px-4 lg:px-6 h-16">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden p-2"
            onClick={onSidebarToggle}
            data-testid="button-sidebar-toggle"
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center space-x-3">
            <div 
              className="w-8 h-8 rounded-md flex items-center justify-center text-white"
              style={{ backgroundColor: primaryColor }}
            >
              {logoUrl ? (
                <img 
                  src={logoUrl} 
                  alt="Logo" 
                  className="w-6 h-6 object-contain"
                />
              ) : (
                <Shield className="h-4 w-4" />
              )}
            </div>
            <span className="font-semibold text-lg" data-testid="text-brand-name">
              {brandName}
            </span>
          </div>
        </div>
        
        <nav className="hidden md:flex items-center space-x-6">
          <a 
            href="#dashboard" 
            className="text-sm font-medium hover:text-primary transition-colors"
            data-testid="link-dashboard"
          >
            Dashboard
          </a>
          {(user?.role === 'super_admin' || user?.role === 'client_admin') && (
            <>
              <a 
                href="#campaigns" 
                className="text-sm font-medium hover:text-primary transition-colors"
                data-testid="link-campaigns"
              >
                Campaigns
              </a>
              <a 
                href="#analytics" 
                className="text-sm font-medium hover:text-primary transition-colors"
                data-testid="link-analytics"
              >
                Analytics
              </a>
            </>
          )}
          <a 
            href="#courses" 
            className="text-sm font-medium hover:text-primary transition-colors"
            data-testid="link-courses"
          >
            Training
          </a>
        </nav>

        <div className="flex items-center space-x-4">
          {/* AI Chat Toggle */}
          <Button
            variant="ghost"
            size="sm"
            className="relative p-2"
            onClick={onChatToggle}
            data-testid="button-ai-chat"
          >
            <MessageCircle className="h-5 w-5" />
            <Badge 
              variant="secondary" 
              className="absolute -top-1 -right-1 w-3 h-3 p-0 bg-accent"
            >
              <span className="sr-only">AI Assistant available</span>
            </Badge>
          </Button>
          
          {/* Notifications */}
          <Button
            variant="ghost"
            size="sm"
            className="relative p-2"
            data-testid="button-notifications"
          >
            <Bell className="h-5 w-5" />
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs"
            >
              3
            </Badge>
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="flex items-center space-x-2 p-2"
                data-testid="button-user-menu"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback 
                    className="text-primary-foreground text-sm font-medium"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden md:block text-sm font-medium">
                  {getRoleDisplay()}
                </span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium" data-testid="text-user-name">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-muted-foreground" data-testid="text-user-email">
                  {user?.email}
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem data-testid="menu-profile">
                Profile Settings
              </DropdownMenuItem>
              <DropdownMenuItem data-testid="menu-preferences">
                Preferences
              </DropdownMenuItem>
              {user?.role !== 'end_user' && (
                <DropdownMenuItem data-testid="menu-admin">
                  Admin Panel
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={logout}
                data-testid="menu-logout"
              >
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
