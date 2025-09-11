import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import UserManagement from '@/components/user-management/UserManagement';
import PhishingCampaigns from '@/components/phishing/PhishingCampaigns';
import CourseDelivery from '@/components/courses/CourseDelivery';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';
import BrandingCustomization from '@/components/branding/BrandingCustomization';

export default function ClientAdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold" data-testid="heading-admin-dashboard">
          Admin Dashboard
        </h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview" data-testid="tab-overview">
            Overview
          </TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-users">
            Users
          </TabsTrigger>
          <TabsTrigger value="campaigns" data-testid="tab-campaigns">
            Campaigns
          </TabsTrigger>
          <TabsTrigger value="courses" data-testid="tab-courses">
            Courses
          </TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">
            Analytics
          </TabsTrigger>
          <TabsTrigger value="branding" data-testid="tab-branding">
            Branding
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Quick stats cards would go here */}
            <div className="text-center p-8 text-muted-foreground">
              Overview dashboard with key metrics coming soon
            </div>
          </div>
        </TabsContent>

        <TabsContent value="users">
          <UserManagement />
        </TabsContent>

        <TabsContent value="campaigns">
          <PhishingCampaigns />
        </TabsContent>

        <TabsContent value="courses">
          <CourseDelivery />
        </TabsContent>

        <TabsContent value="analytics">
          <AnalyticsDashboard />
        </TabsContent>

        <TabsContent value="branding">
          <BrandingCustomization />
        </TabsContent>
      </Tabs>
    </div>
  );
}
