import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  Building, 
  Users, 
  Fish, 
  GraduationCap, 
  BarChart3, 
  Key, 
  Palette,
  BookOpen,
  Award,
  ChartBar,
  Shield,
  Home
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  userRole: string;
}

interface NavItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  roles: string[];
}

const navigationItems: NavItem[] = [
  // Super Admin Section
  {
    title: 'Dashboard',
    icon: Home,
    href: '#dashboard',
    roles: ['super_admin', 'client_admin', 'end_user']
  },
  {
    title: 'Client Management',
    icon: Building,
    href: '#clients',
    roles: ['super_admin']
  },
  {
    title: 'Platform Analytics',
    icon: BarChart3,
    href: '#platform-analytics',
    roles: ['super_admin']
  },
  {
    title: 'License Management',
    icon: Key,
    href: '#licensing',
    roles: ['super_admin']
  },
  
  // Client Admin Section
  {
    title: 'User Management',
    icon: Users,
    href: '#users',
    roles: ['client_admin']
  },
  {
    title: 'Branding',
    icon: Palette,
    href: '#branding',
    roles: ['client_admin']
  },
  {
    title: 'Phishing Campaigns',
    icon: Fish,
    href: '#phishing-campaigns',
    roles: ['super_admin', 'client_admin']
  },
  {
    title: 'Course Assignment',
    icon: GraduationCap,
    href: '#course-assignment',
    roles: ['client_admin']
  },
  {
    title: 'Analytics',
    icon: ChartBar,
    href: '#analytics',
    roles: ['super_admin', 'client_admin']
  },
  
  // End User Section
  {
    title: 'My Courses',
    icon: BookOpen,
    href: '#my-courses',
    roles: ['end_user']
  },
  {
    title: 'Progress',
    icon: ChartBar,
    href: '#progress',
    roles: ['end_user']
  },
  {
    title: 'Certificates',
    icon: Award,
    href: '#certificates',
    roles: ['end_user']
  }
];

export default function Sidebar({ isOpen, onClose, userRole }: SidebarProps) {
  const filteredItems = navigationItems.filter(item => 
    item.roles.includes(userRole)
  );

  const getSectionTitle = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'System Management';
      case 'client_admin':
        return 'Administration';
      case 'end_user':
        return 'Learning';
      default:
        return 'Navigation';
    }
  };

  const handleNavClick = (href: string) => {
    // Close mobile sidebar when navigating
    if (window.innerWidth < 1024) {
      onClose();
    }
    
    // Handle navigation - in a real app, you'd use proper routing
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <aside 
      className={cn(
        "w-64 bg-card border-r border-border h-full z-40 transition-transform duration-300 ease-in-out",
        "fixed lg:relative",
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}
      data-testid="sidebar"
    >
      <div className="p-4 space-y-2">
        <div className="pb-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {getSectionTitle(userRole)}
          </h3>
          <nav className="space-y-1">
            {filteredItems.map((item) => (
              <Button
                key={item.href}
                variant="ghost"
                className={cn(
                  "w-full justify-start space-x-3 h-auto py-2",
                  item.href === '#clients' && userRole === 'super_admin' && 
                  "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
                onClick={() => handleNavClick(item.href)}
                data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.title}</span>
              </Button>
            ))}
          </nav>
        </div>

        {/* Additional sections for multi-role users */}
        {userRole === 'super_admin' && (
          <div className="pt-4 border-t border-border">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Security
            </h3>
            <nav className="space-y-1">
              <Button
                variant="ghost"
                className="w-full justify-start space-x-3 h-auto py-2"
                onClick={() => handleNavClick('#security-settings')}
                data-testid="nav-security-settings"
              >
                <Shield className="w-4 h-4" />
                <span>Security Settings</span>
              </Button>
            </nav>
          </div>
        )}
      </div>
    </aside>
  );
}
