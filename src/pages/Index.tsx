import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Shield, Users, TrendingUp } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h1 className="text-5xl md:text-6xl font-bold text-foreground">
            KINONI SACCO
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Your trusted savings and credit cooperative for secure financial growth
          </p>
          
          <div className="flex gap-4 justify-center flex-wrap">
            <Button size="lg" onClick={() => navigate("/auth?mode=signup")}>
              Get Started <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/auth?mode=login")}>
              Sign In
            </Button>
            <Button size="lg" variant="secondary" onClick={() => navigate("/document")}>
              User Guide
            </Button>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mt-16">
            <div className="p-6 bg-card rounded-lg border shadow-sm">
              <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Secure Management</h3>
              <p className="text-muted-foreground">Role-based access with comprehensive security features</p>
            </div>
            
            <div className="p-6 bg-card rounded-lg border shadow-sm">
              <Users className="h-12 w-12 text-secondary mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Member Portal</h3>
              <p className="text-muted-foreground">Easy account management and loan applications</p>
            </div>
            
            <div className="p-6 bg-card rounded-lg border shadow-sm">
              <TrendingUp className="h-12 w-12 text-accent mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Financial Tracking</h3>
              <p className="text-muted-foreground">Complete transaction history and reporting</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
