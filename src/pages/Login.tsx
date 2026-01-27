import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

const Login = () => {
  const { user, signInWithGoogle } = useAuth();

  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="text-center">
        <img
          src="/logo.png"
          alt="Kriyaa"
          className="mx-auto mb-4 h-16 w-16 rounded-xl"
        />
        <h1 className="mb-4 text-4xl font-bold">Hare Krishna, Welcome to Kriyaa</h1>
        <p className="mb-8 text-muted-foreground">Please sign in to continue</p>
        <Button onClick={signInWithGoogle} size="lg">
          Sign in with Google
        </Button>
      </div>
    </div>
  );
};

export default Login;
