import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { useState } from "react";
import { Loader2 } from "lucide-react";

const Login = () => {
  const { user, signInWithGoogle } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Sign in error:", error);
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="text-center">
        <img
          src="/logo.png"
          alt="Ekaagra"
          className="mx-auto mb-4 h-16 w-16 rounded-xl"
        />
        <h1 className="mb-4 text-4xl font-bold">Hare Krishna, Welcome to Ekaagra</h1>
        <p className="mb-8 text-muted-foreground">Please sign in to continue</p>
        <Button onClick={handleSignIn} size="lg" disabled={isSigningIn}>
          {isSigningIn ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            "Sign in with Google"
          )}
        </Button>
      </div>
    </div>
  );
};

export default Login;
