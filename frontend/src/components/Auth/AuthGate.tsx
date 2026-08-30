import React, { useState, useEffect } from 'react';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { auth, googleProvider, isConfigured } from '../../config/firebase';

interface AuthGateProps {
  children: React.ReactNode;
}

const ALLOWED_EMAIL = 'avinash1bmv@gmail.com';

const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [bypassUser, setBypassUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isLocalhost = () => {
    return (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.startsWith('192.168.')
    );
  };

  useEffect(() => {
    // Only check or allow bypass if we are on localhost/development
    if (isLocalhost()) {
      const savedBypass = localStorage.getItem('auth_bypass_user');
      if (savedBypass) {
        setBypassUser(savedBypass);
      }
    }

    if (!isConfigured || !auth) {
      setLoading(false);
      // If running on a public server and Firebase is not configured, show a configuration error
      if (!isLocalhost()) {
        setError("Security Setup Required: Firebase environment variables (VITE_FIREBASE_*) are missing. Please configure them in your Vercel Project Settings.");
      }
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      if (firebaseUser && firebaseUser.email !== ALLOWED_EMAIL) {
        setError(`Access Denied: Email "${firebaseUser.email}" is not authorized.`);
      } else {
        setError(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    if (!auth) return;
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const loggedUser = result.user;
      if (loggedUser.email !== ALLOWED_EMAIL) {
        setError(`Access Denied: Email "${loggedUser.email}" is not authorized.`);
        await signOut(auth);
      }
    } catch (err: any) {
      console.error('Google Sign-In failed:', err);
      setError(err.message || 'Failed to authenticate via Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      if (auth) {
        await signOut(auth);
      }
      localStorage.removeItem('auth_bypass_user');
      setBypassUser(null);
      setUser(null);
      setError(null);
    } catch (err) {
      console.error('Sign-Out failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBypassLogin = () => {
    localStorage.setItem('auth_bypass_user', ALLOWED_EMAIL);
    setBypassUser(ALLOWED_EMAIL);
    setError(null);
  };

  // If loading, show a beautiful dark loading screen
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loader}></div>
        <p style={styles.loadingText}>Securing Connection...</p>
      </div>
    );
  }

  // If authenticated as the correct user (either via Firebase or Bypass), render dashboard
  const isAuthenticated = (user && user.email === ALLOWED_EMAIL) || (isLocalhost() && bypassUser === ALLOWED_EMAIL);
  if (isAuthenticated) {
    // Add a tiny floating logout button in the admin interface for convenience
    return (
      <>
        <div style={styles.floatingHeader}>
          <span style={styles.userEmail}>
            Admin: {user ? user.email : bypassUser} 
            {!isConfigured && <span style={styles.bypassTag}>(Local Bypass)</span>}
          </span>
          <button onClick={handleLogout} style={styles.logoutButton}>
            Log Out
          </button>
        </div>
        {children}
      </>
    );
  }

  // Otherwise, render the Login Screen / Access Denied page
  return (
    <div style={styles.container}>
      <div style={styles.loginCard}>
        <div style={styles.logoContainer}>
          <div style={styles.lockIcon}>🔐</div>
          <h1 style={styles.title}>DealsOptimised</h1>
          <p style={styles.subtitle}>Administrative Control Portal</p>
        </div>

        {error && (
          <div style={styles.errorContainer}>
            <p style={styles.errorText}>{error}</p>
          </div>
        )}

        {isConfigured && auth ? (
          <div>
            <button onClick={handleGoogleLogin} style={styles.googleButton}>
              <svg style={styles.googleSvg} viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.34 0-6.05-2.71-6.05-6.05s2.71-6.05 6.05-6.05c1.478 0 2.825.53 3.882 1.408l3.111-3.11C18.98 2.868 15.86 1.5 12.24 1.5c-5.79 0-10.5 4.71-10.5 10.5s4.71 10.5 10.5 10.5c5.312 0 9.878-3.8 9.878-10.5 0-.616-.073-1.136-.208-1.714H12.24z"
                />
              </svg>
              Sign in with Google
            </button>
            {isLocalhost() && (
              <div style={{ marginTop: '16px' }}>
                <button onClick={handleBypassLogin} style={styles.bypassButton}>
                  Bypass as Developer ({ALLOWED_EMAIL})
                </button>
              </div>
            )}
          </div>
        ) : (
          isLocalhost() ? (
            <div style={styles.bypassContainer}>
              <p style={styles.bypassWarning}>
                ⚠️ Firebase authentication client configuration not found. 
              </p>
              <button onClick={handleBypassLogin} style={styles.bypassButton}>
                Bypass as Developer ({ALLOWED_EMAIL})
              </button>
            </div>
          ) : (
            <div style={styles.bypassContainer}>
              <p style={styles.bypassWarning}>
                ⚠️ Security Setup Error: Firebase configurations are not set on this server.
              </p>
            </div>
          )
        )}

        <div style={styles.footer}>
          Secured with Firebase Google OAuth checks.
        </div>
      </div>
    </div>
  );
};

// Premium Styles for WOW Aesthetics (Glassmorphism, Neon glows, dark-theme layout)
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    width: '100vw',
    backgroundColor: '#0a0d16',
    backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(98, 114, 241, 0.15) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(253, 93, 147, 0.15) 0%, transparent 45%)',
    fontFamily: '"Outfit", "Inter", sans-serif',
    color: '#f8fafc',
    margin: 0,
    padding: '20px',
    boxSizing: 'border-box'
  },
  loader: {
    width: '48px',
    height: '48px',
    border: '4px solid rgba(255, 255, 255, 0.1)',
    borderTop: '4px solid #6366f1',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    marginTop: '16px',
    fontSize: '14px',
    color: '#94a3b8',
    letterSpacing: '1px'
  },
  loginCard: {
    width: '100%',
    maxWidth: '420px',
    backgroundColor: 'rgba(16, 22, 38, 0.6)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '16px',
    padding: '40px 32px',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
    textAlign: 'center',
    boxSizing: 'border-box'
  },
  logoContainer: {
    marginBottom: '32px'
  },
  lockIcon: {
    fontSize: '48px',
    marginBottom: '16px',
    filter: 'drop-shadow(0 0 10px rgba(99, 102, 241, 0.5))'
  },
  title: {
    fontSize: '28px',
    fontWeight: 700,
    margin: '0 0 8px 0',
    background: 'linear-gradient(135deg, #f8fafc 0%, #a5b4fc 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    letterSpacing: '-0.5px'
  },
  subtitle: {
    fontSize: '14px',
    color: '#64748b',
    margin: 0
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    borderRadius: '8px',
    padding: '12px 16px',
    marginBottom: '24px',
    textAlign: 'left'
  },
  errorText: {
    color: '#ef4444',
    fontSize: '13px',
    margin: 0,
    lineHeight: 1.4
  },
  googleButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '48px',
    backgroundColor: '#ffffff',
    color: '#1e293b',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
  },
  googleSvg: {
    width: '18px',
    height: '18px',
    marginRight: '12px'
  },
  bypassContainer: {
    backgroundColor: 'rgba(234, 179, 8, 0.08)',
    border: '1px solid rgba(234, 179, 8, 0.15)',
    borderRadius: '8px',
    padding: '16px',
    textAlign: 'center'
  },
  bypassWarning: {
    color: '#eab308',
    fontSize: '12px',
    margin: '0 0 12px 0',
    lineHeight: 1.4
  },
  bypassButton: {
    backgroundColor: '#6366f1',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  footer: {
    marginTop: '32px',
    fontSize: '11px',
    color: '#475569'
  },
  floatingHeader: {
    position: 'fixed',
    top: '12px',
    right: '12px',
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 22, 38, 0.8)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '30px',
    padding: '6px 14px',
    zIndex: 9999,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
  },
  userEmail: {
    fontSize: '12px',
    color: '#94a3b8',
    marginRight: '12px',
    fontWeight: 500
  },
  bypassTag: {
    color: '#eab308',
    marginLeft: '4px',
    fontSize: '10px'
  },
  logoutButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '20px',
    color: '#ef4444',
    padding: '4px 12px',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  }
};

export default AuthGate;
