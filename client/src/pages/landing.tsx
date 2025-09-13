import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLocation } from 'wouter';
import { Shield, Users, Brain, Mail, BarChart3, Lock, Target, Zap, CheckCircle2, Star } from 'lucide-react';

export default function Landing() {
  const [, navigate] = useLocation();

  const features = [
    {
      icon: Shield,
      title: "Advanced Phishing Simulation",
      description: "Real-world email phishing campaigns with comprehensive tracking and analytics"
    },
    {
      icon: Brain,
      title: "AI-Powered Learning",
      description: "OpenAI-driven course generation, personalized recommendations, and intelligent chatbot assistance"
    },
    {
      icon: Users,
      title: "Multi-Tenant Architecture",
      description: "Complete white-label solution with client-specific branding and isolated data"
    },
    {
      icon: BarChart3,
      title: "Comprehensive Analytics",
      description: "Real-time reporting, progress tracking, and detailed campaign performance metrics"
    },
    {
      icon: Mail,
      title: "Professional Email Delivery",
      description: "SendGrid integration for reliable email delivery and detailed tracking"
    },
    {
      icon: Lock,
      title: "Enterprise Security",
      description: "Role-based access control, JWT authentication, and encrypted data storage"
    }
  ];

  const testimonials = [
    {
      name: "Sarah Johnson",
      role: "CISO at TechCorp",
      content: "CyberAware Pro transformed our security awareness training. Our phishing click rates dropped by 75% in just 3 months.",
      rating: 5
    },
    {
      name: "Mike Chen",
      role: "Security Manager at GlobalBank",
      content: "The AI-powered personalization and real-time analytics give us insights we never had before. Exceptional platform!",
      rating: 5
    },
    {
      name: "Dr. Emily Rodriguez",
      role: "IT Director at MedHealth",
      content: "White-label capabilities allowed us to seamlessly integrate this into our existing training ecosystem. Highly recommend!",
      rating: 5
    }
  ];

  const stats = [
    { label: "Enterprise Clients", value: "500+" },
    { label: "Users Trained", value: "50K+" },
    { label: "Phishing Tests Sent", value: "2M+" },
    { label: "Security Incidents Prevented", value: "10K+" }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex h-16 items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="font-bold text-xl">CyberAware Pro</div>
          </div>
          
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#testimonials" className="text-muted-foreground hover:text-foreground transition-colors">Testimonials</a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
            <Button 
              variant="outline" 
              onClick={() => navigate('/login')}
              className="ml-4"
            >
              Sign In
            </Button>
          </nav>

          <Button 
            className="md:hidden" 
            variant="ghost" 
            size="icon"
            onClick={() => navigate('/login')}
          >
            <Lock className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-primary/5 to-accent/5">
        <div className="container mx-auto text-center max-w-4xl">
          <Badge variant="secondary" className="mb-6">
            <Zap className="w-3 h-3 mr-1" />
            Enterprise-Ready Security Training
          </Badge>
          
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
            Transform Your Team's
            <span className="text-primary block mt-2">Cybersecurity Awareness</span>
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Professional white-label cybersecurity training platform with AI-powered learning, 
            real phishing simulations, and comprehensive analytics for enterprise organizations.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button 
              size="lg" 
              className="text-lg px-8 py-6"
              onClick={() => navigate('/login')}
            >
              <Target className="w-5 h-5 mr-2" />
              Get Started
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="text-lg px-8 py-6"
              onClick={() => navigate('/login')}
            >
              <Users className="w-5 h-5 mr-2" />
              Learn More
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl font-bold text-primary mb-1">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Everything You Need for Modern Security Training
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Our comprehensive platform combines cutting-edge AI technology with proven 
              cybersecurity training methodologies.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="h-full hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Trusted by Security Leaders Worldwide
            </h2>
            <p className="text-xl text-muted-foreground">
              See what industry experts are saying about CyberAware Pro
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="h-full">
                <CardHeader>
                  <div className="flex mb-2">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                    ))}
                  </div>
                  <CardDescription className="text-base italic">
                    "{testimonial.content}"
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="font-semibold">{testimonial.name}</div>
                  <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-primary text-primary-foreground">
        <div className="container mx-auto text-center max-w-4xl">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">
            Ready to Strengthen Your Security Posture?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of organizations already using CyberAware Pro to build 
            stronger security awareness and prevent cyber attacks.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              variant="secondary"
              className="text-lg px-8 py-6"
              onClick={() => navigate('/login')}
            >
              <CheckCircle2 className="w-5 h-5 mr-2" />
              Start Free Trial
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="text-lg px-8 py-6 border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary"
              onClick={() => navigate('/login')}
            >
              <Mail className="w-5 h-5 mr-2" />
              Contact Sales
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="font-bold text-xl">CyberAware Pro</div>
            </div>
            
            <div className="flex items-center space-x-6 text-sm text-muted-foreground">
              <span>© 2024 CyberAware Pro. All rights reserved.</span>
              <Button 
                variant="link" 
                className="p-0 h-auto font-normal"
                onClick={() => navigate('/login')}
              >
                Privacy Policy
              </Button>
              <Button 
                variant="link" 
                className="p-0 h-auto font-normal"
                onClick={() => navigate('/login')}
              >
                Terms of Service
              </Button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}