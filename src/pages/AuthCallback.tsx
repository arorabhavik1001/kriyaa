import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/lib/firebase";

const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      signInWithCustomToken(auth, token)
        .then(() => {
          navigate("/", { replace: true });
        })
        .catch((error) => {
          console.error("Login failed", error);
          navigate("/login?error=auth_failed");
        });
    } else {
        navigate("/login?error=no_token");
    }
  }, [searchParams, navigate]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      <span className="ml-2">Logging in...</span>
    </div>
  );
};

export default AuthCallback;
