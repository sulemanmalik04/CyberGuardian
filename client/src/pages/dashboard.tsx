import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import SuperAdminDashboard from '@/components/dashboard/SuperAdminDashboard';
import ClientAdminDashboard from '@/components/dashboard/ClientAdminDashboard';
import UserDashboard from '@/components/dashboard/UserDashboard';
import AIChatbot from '@/components/ai/AIChatbot';

export default function Dashboard() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  if (!user) return null;

  const renderDashboard = () => {
    switch (user.role) {
      case 'super_admin':
        return <SuperAdminDashboard />;
      case 'client_admin':
        return <ClientAdminDashboard />;
      case 'end_user':
        return <UserDashboard />;
      default:
        return <div>Unknown user role</div>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header 
        onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
        onChatToggle={() => setChatOpen(!chatOpen)}
      />
      
      <div className="flex h-[calc(100vh-4rem)]">
        <Sidebar 
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          userRole={user.role}
        />
        
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="fade-in">
            {renderDashboard()}
          </div>
        </main>
      </div>

      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          data-testid="sidebar-overlay"
        />
      )}

      <AIChatbot 
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
      />
    </div>
  );
}
