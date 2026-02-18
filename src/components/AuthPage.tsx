import React, { useState } from 'react';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const AUTH_BLUE = '#007AFF';
const INPUT_BORDER = '#E0E0E0';
const PLACEHOLDER_GRAY = '#BDBDBD';
const INACTIVE_TAB_GRAY = '#828282';
const CARD_SHADOW = '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05)';
const CARD_PADDING_X = '4rem';
const CARD_PADDING_TOP = '4rem';
const CARD_PADDING_BOTTOM = '4rem';
const SECTION_GAP = '3rem';

type AuthMode = 'signin' | 'signup';

export const AuthPage: React.FC = () => {
  const { signIn, signUp, loading, error: authError, setError: setAuthError } = useAuth();
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const isSignUp = authMode === 'signup';

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    setAuthError(null);

    if (isSignUp && password !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }

    let success = false;
    if (isSignUp) {
      success = await signUp(email, password);
      if (success) {
        // Auto sign-in after successful signup so user lands on dashboard
        const signedIn = await signIn(email, password);
        if (!signedIn) {
          setAuthMode('signin');
        }
        setConfirmPassword('');
      }
    } else {
      success = await signIn(email, password);
    }
  };

  const toggleMode = () => {
    setAuthMode(isSignUp ? 'signin' : 'signup');
    setLocalError('');
    setAuthError(null);
  };

  const currentError = localError || authError;

  const inputStyle = {
    border: `1px solid ${INPUT_BORDER}`,
    borderRadius: '8px',
  };

  return (
    <>
      <style>{`
        .auth-page-input::placeholder { color: ${PLACEHOLDER_GRAY}; }
        .auth-page-input:focus { outline: none; border-color: ${AUTH_BLUE}; box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.2); }
      `}</style>
    <div className="min-h-screen w-full flex items-center justify-center p-4" style={{ backgroundColor: '#F8F8F8' }}>
      <div
        className="bg-white w-full overflow-hidden"
        style={{
          maxWidth: '32rem',
          borderRadius: '12px',
          boxShadow: CARD_SHADOW,
        }}
      >
        {/* Header */}
        <div className="text-center" style={{ paddingLeft: CARD_PADDING_X, paddingRight: CARD_PADDING_X, paddingTop: CARD_PADDING_TOP, paddingBottom: SECTION_GAP }}>
          <h1 className="text-3xl font-bold mb-2" style={{ color: '#1A1A1A' }}>
            OenoBI: Blackbird
          </h1>
          <p className="text-sm" style={{ color: '#6b7280' }}>
            {isSignUp
              ? 'Sign up to get started with our platform'
              : 'Enter your credentials to access your account'}
          </p>
        </div>

        {/* Toggle with blue underline for active tab */}
        <div
          className="flex justify-center gap-12"
          style={{ paddingLeft: CARD_PADDING_X, paddingRight: CARD_PADDING_X, marginBottom: SECTION_GAP }}
        >
          <button
            type="button"
            onClick={() => setAuthMode('signin')}
            className="flex flex-col items-center cursor-pointer border-0 bg-transparent p-0"
            style={{
              color: !isSignUp ? AUTH_BLUE : INACTIVE_TAB_GRAY,
              fontSize: '0.875rem',
              fontWeight: !isSignUp ? 700 : 400,
              minWidth: '4.5rem',
            }}
          >
            <span>Sign In</span>
            <span
              style={{
                marginTop: '0.5rem',
                height: '2px',
                width: '100%',
                backgroundColor: !isSignUp ? AUTH_BLUE : 'transparent',
                borderRadius: '999px',
              }}
            />
          </button>
          <button
            type="button"
            onClick={() => setAuthMode('signup')}
            className="flex flex-col items-center cursor-pointer border-0 bg-transparent p-0"
            style={{
              color: isSignUp ? AUTH_BLUE : INACTIVE_TAB_GRAY,
              fontSize: '0.875rem',
              fontWeight: isSignUp ? 700 : 400,
              minWidth: '4.5rem',
            }}
          >
            <span>Sign Up</span>
            <span
              style={{
                marginTop: '0.5rem',
                height: '2px',
                width: '100%',
                backgroundColor: isSignUp ? AUTH_BLUE : 'transparent',
                borderRadius: '999px',
              }}
            />
          </button>
        </div>

        {/* Form */}
        <form className="space-y-4" onSubmit={handleAuth} style={{ paddingLeft: CARD_PADDING_X, paddingRight: CARD_PADDING_X, paddingBottom: CARD_PADDING_BOTTOM }}>
          <div className="space-y-2">
            <label className="text-sm block" style={{ color: '#1A1A1A', fontWeight: 400 }}>
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 pointer-events-none" style={{ color: PLACEHOLDER_GRAY }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="auth-page-input w-full pl-10 pr-4 py-2.5 outline-none transition-[border-color,box-shadow]"
                style={inputStyle}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm block" style={{ color: '#1A1A1A', fontWeight: 400 }}>
                Password
              </label>
              {!isSignUp && (
                <a
                  href="#"
                  className="text-xs cursor-pointer"
                  style={{ color: AUTH_BLUE, fontWeight: 400 }}
                >
                  Forgot password?
                </a>
              )}
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 pointer-events-none" style={{ color: PLACEHOLDER_GRAY }} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="auth-page-input w-full pl-10 pr-4 py-2.5 outline-none transition-[border-color,box-shadow]"
                style={inputStyle}
              />
            </div>
          </div>

          {isSignUp && (
            <div className="space-y-2">
              <label className="text-sm block" style={{ color: '#1A1A1A', fontWeight: 400 }}>
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 pointer-events-none" style={{ color: PLACEHOLDER_GRAY }} />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="auth-page-input w-full pl-10 pr-4 py-2.5 outline-none transition-[border-color,box-shadow]"
                  style={inputStyle}
                />
              </div>
            </div>
          )}

          {currentError && (
            <div className="text-sm text-red-700 bg-red-50 p-4 rounded-lg border border-red-200">
              {currentError}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg transition-opacity flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            style={{
              marginTop: '2.5rem',
              backgroundColor: AUTH_BLUE,
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.9375rem',
            }}
          >
            {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
            <ArrowRight className="h-4 w-4" style={{ flexShrink: 0 }} />
          </button>

          <p className="text-center text-sm" style={{ color: '#6b7280', fontWeight: 400, marginTop: '2.5rem' }}>
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            <button
              type="button"
              onClick={toggleMode}
              className="font-medium cursor-pointer bg-transparent border-0 p-0"
              style={{ color: AUTH_BLUE }}
            >
              {isSignUp ? 'Log in' : 'Sign up'}
            </button>
          </p>
        </form>
      </div>
    </div>
    </>
  );
};
