import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Phone, Mail } from "lucide-react";
import { ForgotPasswordDialog } from "@/components/auth/ForgotPasswordDialog";
import { UpdatePasswordForm } from "@/components/auth/UpdatePasswordForm";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PasswordInput } from "@/components/ui/password-input";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const mode = searchParams.get("mode");
  const isSignup = mode === "signup";
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [loginMethod, setLoginMethod] = useState<"email" | "phone">("phone");
  const [signupMethod, setSignupMethod] = useState<"email" | "phone">("phone");
  const [signupPassword, setSignupPassword] = useState("");

  useEffect(() => {
    // Only redirect on explicit sign-in events, not on page load with existing session
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsResettingPassword(true);
      } else if (event === "SIGNED_IN" && session && !isResettingPassword) {
        // Only redirect when user explicitly signs in
        navigate("/dashboard");
      }
    });

    // Check for password reset mode
    if (searchParams.get("reset") === "true") {
      setIsResettingPassword(true);
    }

    return () => subscription.unsubscribe();
  }, [navigate, searchParams, isResettingPassword]);

  const handleEmailLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }

    setLoading(false);
  };

  const handlePhoneLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const phone = formData.get("phone") as string;
    const password = formData.get("password") as string;

    const { data: email, error: rpcError } = await supabase.rpc("get_email_by_phone", {
      p_phone_number: phone,
    });

    if (rpcError || !email) {
      toast({
        title: "Error",
        description: "No account found with this phone number",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }

    setLoading(false);
  };

  const handleEmailSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const fullName = formData.get("fullName") as string;
    const phoneNumber = formData.get("phoneNumber") as string;
    const nationalId = formData.get("nationalId") as string;
    const occupation = formData.get("occupation") as string;
    const address = formData.get("address") as string;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({
        phone_number: phoneNumber,
        national_id: nationalId,
        occupation,
        address,
      }).eq("id", user.id);
    }

    toast({
      title: "Success",
      description: "Account created successfully!",
    });

    setLoading(false);
  };

  const handlePhoneSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const phone = formData.get("phone") as string;
    const password = formData.get("password") as string;
    const fullName = formData.get("fullName") as string;
    const nationalId = formData.get("nationalId") as string;
    const occupation = formData.get("occupation") as string;
    const address = formData.get("address") as string;

    const generatedEmail = `${phone.replace(/[^0-9]/g, "")}@kinoni-sacco.local`;

    const { error, data } = await supabase.auth.signUp({
      email: generatedEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    if (data.user) {
      await supabase.from("profiles").update({
        phone_number: phone,
        national_id: nationalId,
        occupation,
        address,
      }).eq("id", data.user.id);
    }

    toast({
      title: "Success",
      description: "Account created successfully! You can now login with your phone number.",
    });

    setLoading(false);
  };

  if (isResettingPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <UpdatePasswordForm />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">KINONI SACCO</CardTitle>
          <CardDescription className="text-center">
            {isSignup ? "Create a new account" : "Sign in to your account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isSignup ? (
            // SIGNUP CONTENT ONLY
            <>
              <div className="flex gap-2 mb-4">
                <Button
                  type="button"
                  variant={signupMethod === "phone" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setSignupMethod("phone")}
                >
                  <Phone className="mr-2 h-4 w-4" />
                  Phone
                </Button>
                <Button
                  type="button"
                  variant={signupMethod === "email" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setSignupMethod("email")}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Email
                </Button>
              </div>

              {signupMethod === "email" ? (
                <form onSubmit={handleEmailSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      name="fullName"
                      type="text"
                      placeholder="John Doe"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">Phone Number</Label>
                    <Input
                      id="phoneNumber"
                      name="phoneNumber"
                      type="tel"
                      placeholder="+256 700 000000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nationalId">National ID</Label>
                    <Input
                      id="nationalId"
                      name="nationalId"
                      type="text"
                      placeholder="CM123456789"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="occupation">Occupation</Label>
                    <Input
                      id="occupation"
                      name="occupation"
                      type="text"
                      placeholder="Teacher"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      name="address"
                      type="text"
                      placeholder="Kampala, Uganda"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <PasswordInput
                      id="password"
                      name="password"
                      required
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                    />
                    <PasswordStrengthIndicator password={signupPassword} />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Account
                  </Button>
                </form>
              ) : (
                <form onSubmit={handlePhoneSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-fullName">Full Name</Label>
                    <Input
                      id="signup-fullName"
                      name="fullName"
                      type="text"
                      placeholder="John Doe"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-phone">Phone Number</Label>
                    <Input
                      id="signup-phone"
                      name="phone"
                      type="tel"
                      placeholder="+256 700 000000"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-nationalId">National ID</Label>
                    <Input
                      id="signup-nationalId"
                      name="nationalId"
                      type="text"
                      placeholder="CM123456789"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-occupation">Occupation</Label>
                    <Input
                      id="signup-occupation"
                      name="occupation"
                      type="text"
                      placeholder="Teacher"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-address">Address</Label>
                    <Input
                      id="signup-address"
                      name="address"
                      type="text"
                      placeholder="Kampala, Uganda"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <PasswordInput
                      id="signup-password"
                      name="password"
                      required
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                    />
                    <PasswordStrengthIndicator password={signupPassword} />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Account
                  </Button>
                </form>
              )}

              <div className="mt-6 text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link to="/auth?mode=login" className="text-primary hover:underline font-medium">
                  Sign in
                </Link>
              </div>
            </>
          ) : (
            // LOGIN CONTENT ONLY
            <>
              <div className="flex gap-2 mb-4">
                <Button
                  type="button"
                  variant={loginMethod === "phone" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setLoginMethod("phone")}
                >
                  <Phone className="mr-2 h-4 w-4" />
                  Phone
                </Button>
                <Button
                  type="button"
                  variant={loginMethod === "email" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setLoginMethod("email")}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Email
                </Button>
              </div>

              {loginMethod === "email" ? (
                <form onSubmit={handleEmailLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      name="email"
                      type="email"
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <PasswordInput
                      id="login-password"
                      name="password"
                      required
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <ForgotPasswordDialog />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sign In
                  </Button>
                </form>
              ) : (
                <form onSubmit={handlePhoneLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-phone">Phone Number</Label>
                    <Input
                      id="login-phone"
                      name="phone"
                      type="tel"
                      placeholder="+256 700 000000"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-phone-password">Password</Label>
                    <PasswordInput
                      id="login-phone-password"
                      name="password"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sign In
                  </Button>
                </form>
              )}

              <div className="mt-6 text-center text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link to="/auth?mode=signup" className="text-primary hover:underline font-medium">
                  Sign up
                </Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;