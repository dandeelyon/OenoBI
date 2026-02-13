import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  user: { email: string } | null;
  loading: boolean;
  error: string | null; // Add error to context type
  setError: React.Dispatch<React.SetStateAction<string | null>>; // Add setError to context type
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<boolean>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = `${import.meta.env.VITE_BACKEND_URL}/backend-api`;

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null); // State to hold authentication errors

  useEffect(() => {
    const checkSession = async () => {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      if (token) {
        // Validate token with backend
        try {
          const response = await fetch(`${API_BASE_URL}/users/me`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (response.ok) {
            const userData = await response.json();
            setIsAuthenticated(true);
            setUser({ email: userData.email });
          } else {
            localStorage.removeItem('authToken');
          }
        } catch (err) {
          console.error("Error validating token:", err);
          localStorage.removeItem('authToken');
        }
      }
      setLoading(false);
    };
    checkSession();
  }, []);

  const signIn = async (email: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          username: email,
          password: password,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('authToken', data.access_token);
        setIsAuthenticated(true);
        setUser({ email });
        return true;
      } else {
        // Handle specific error codes or fallbacks for non-JSON responses
        if (response.status === 401) {
          // Specific message for "user not found" or "invalid credentials"
          setError("Invalid credentials or user not found. Please sign up if you don't have an account.");
        } else {
          try {
            const errorData = await response.json();
            setError(errorData.detail || 'Sign in failed');
          } catch (jsonError) {
            // Fallback for non-JSON error responses (e.g., empty body, HTML error)
            const textError = await response.text();
            setError(`Sign in failed: ${response.status} ${response.statusText} - ${textError.substring(0, 100)}...`);
          }
        }
        return false;
      }
    } catch (err: any) {
      setError(err.message || 'Sign in failed due to network error.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, confirm_password: password }), // FastAPI expects JSON for UserCreate
      });

      if (response.ok) {
        await response.json(); // Consume response
        return true;
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Sign up failed');
        return false;
      }
    } catch (err: any) {
      setError(err.message || 'Sign up failed due to network error.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const signOut = () => {
    localStorage.removeItem('authToken');
    setIsAuthenticated(false);
    setUser(null);
    setError(null); // Clear any errors on sign out
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, loading, error, setError, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
