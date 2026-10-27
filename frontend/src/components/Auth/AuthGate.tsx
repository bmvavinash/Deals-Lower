import React, { useState, useEffect } from 'react';
import { signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { auth, googleProvider, isConfigured } from '../../config/firebase';
import { authAPI } from '../../services/api';

interface AuthGateProps {
  children: React.ReactNode;
}

// Authorized administrator emails per user requirement
const ALLOWED_ADMIN_EMAILS = ['avinash1bmv@gmail.com', 'avi2bmv@gmail.com'];

const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [bypassUser, setBypassUser] = useState<string | null>(null);
  const [adminSession, setAdminSession] = useState<{ email: string; token: string } | null>(() => {
    try {
      const saved = localStorage.getItem('admin_auth_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.email && parsed.token) {
          return parsed;
        }
      }
    } catch {
      // ignore JSON parse error
    }
    return null;
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
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
    // 1. Verify persisted backend admin session on load
    const saved = localStorage.getItem('admin_auth_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.token) {
          authAPI.verify(parsed.token).catch(() => {
            console.warn('Backend session expired or invalid. Clearing saved session.');
            localStorage.removeItem('admin_auth_session');
            setAdminSession(null);
          });
        }
      } catch {
        localStorage.removeItem('admin_auth_session');
      }
    }

    // 2. Check local development bypass
    if (isLocalhost()) {
      const savedBypass = localStorage.getItem('auth_bypass_user');
      if (savedBypass) {
        setBypassUser(savedBypass);
      }
    }

    // 3. Optional Firebase Auth listener
    if (!isConfigured || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const norm = (firebaseUser.email || '').toLowerCase();
        if (!ALLOWED_ADMIN_EMAILS.includes(norm)) {
          setError(`Access Denied: Email "${firebaseUser.email}" is not authorized.`);
          await signOut(auth);
          setUser(null);
        } else {
          setUser(firebaseUser);
          setError(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Stop loading once initial checks are ready
  useEffect(() => {
    if (!isConfigured || !auth) {
      setLoading(false);
    }
  }, []);

  // Normal Email + Password login (Backend verification)
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const normalized = email.trim().toLowerCase();
    if (!ALLOWED_ADMIN_EMAILS.includes(normalized)) {
      setError('Access Denied: Invalid credentials or unauthorized account.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsLoggingIn(true);
    try {
      const response = await authAPI.login(normalized, password);
      if (response.data && response.data.success) {
        const newSession = {
          email: response.data.user.email,
          token: response.data.token
        };
        localStorage.setItem('admin_auth_session', JSON.stringify(newSession));
        setAdminSession(newSession);
        setError(null);
      } else {
        setError(response.data?.error || 'Authentication failed. Please verify password.');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      const backendError = err.response?.data?.error || err.message || 'Login failed. Please check your credentials.';
      setError(backendError);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!auth) return;
    setLoading(true);
    setError(null);
    try {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      
      const result = await signInWithPopup(auth, googleProvider);
      const loggedUser = result.user;
      const norm = (loggedUser.email || '').toLowerCase();
      if (!ALLOWED_ADMIN_EMAILS.includes(norm)) {
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
      localStorage.removeItem('admin_auth_session');
      setAdminSession(null);
      localStorage.removeItem('auth_bypass_user');
      setBypassUser(null);
      if (auth) {
        await signOut(auth);
      }
      setUser(null);
      setError(null);
    } catch (err) {
      console.error('Sign-Out failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBypassLogin = () => {
    localStorage.setItem('auth_bypass_user', ALLOWED_ADMIN_EMAILS[0]);
    setBypassUser(ALLOWED_ADMIN_EMAILS[0]);
    setError(null);
  };

  // If loading, show a dark loading screen
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loader}></div>
        <p style={styles.loadingText}>Securing Connection...</p>
      </div>
    );
  }

  // Authentication check
  const isAuthenticated = 
    Boolean(adminSession && adminSession.email && ALLOWED_ADMIN_EMAILS.includes(adminSession.email.toLowerCase())) ||
    Boolean(user && user.email && ALLOWED_ADMIN_EMAILS.includes(user.email.toLowerCase())) ||
    Boolean(isLocalhost() && bypassUser && ALLOWED_ADMIN_EMAILS.includes(bypassUser.toLowerCase()));

  if (isAuthenticated) {
    const currentAdminEmail = adminSession?.email || user?.email || bypassUser || ALLOWED_ADMIN_EMAILS[0];
    return (
      <>
        <div style={styles.floatingHeader}>
          <span style={styles.userEmail}>
            Admin: {currentAdminEmail}
            {adminSession && <span style={styles.sessionTag}>(Verified Session)</span>}
            {!isConfigured && isLocalhost() && !adminSession && <span style={styles.bypassTag}>(Local Bypass)</span>}
          </span>
          <button onClick={handleLogout} style={styles.logoutButton}>
            Log Out
          </button>
        </div>
        {children}
      </>
    );
  }

  // Render Login Card
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

        {/* Email & Password Login Form */}
        <form onSubmit={handleEmailLogin} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Admin Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your administrator email"
              style={styles.input}
              required
              disabled={isLoggingIn}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter backend administrator password"
              style={styles.input}
              required
              disabled={isLoggingIn}
            />
          </div>

          <button
            type="submit"
            disabled={isLoggingIn || !password}
            style={isLoggingIn ? { ...styles.submitButton, opacity: 0.7 } : styles.submitButton}
          >
            {isLoggingIn ? 'Verifying with Server...' : 'Sign In with Password'}
          </button>
        </form>

        {/* Optional Google Sign-In or Developer Bypass */}
        {isConfigured && auth ? (
          <div style={{ marginTop: '20px' }}>
            <div style={styles.divider}>
              <span style={styles.dividerLine}></span>
              <span style={styles.dividerText}>OR</span>
              <span style={styles.dividerLine}></span>
            </div>

            <button onClick={handleGoogleLogin} style={styles.googleButton}>
              <svg style={styles.googleSvg} viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.34 0-6.05-2.71-6.05-6.05s2.71-6.05 6.05-6.05c1.478 0 2.825.53 3.882 1.408l3.111-3.11C18.98 2.868 15.86 1.5 12.24 1.5c-5.79 0-10.5 4.71-10.5 10.5s4.71 10.5 10.5 10.5c5.312 0 9.878-3.8 9.878-10.5 0-.616-.073-1.136-.208-1.714H12.24z"
                />
              </svg>
              Sign in with Google
            </button>
          </div>
        ) : null}

        {isLocalhost() && (
          <div style={{ marginTop: '16px' }}>
            <button onClick={handleBypassLogin} style={styles.bypassButton}>
              Bypass as Developer
            </button>
          </div>
        )}

        <div style={styles.footer}>
          DealsOptimised Administrative Portal • Authorized Access Only
        </div>
      </div>
    </div>
  );
};

// Premium Styles
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
    maxWidth: '430px',
    backgroundColor: 'rgba(16, 22, 38, 0.75)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '16px',
    padding: '36px 32px',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
    textAlign: 'center',
    boxSizing: 'border-box'
  },
  logoContainer: {
    marginBottom: '24px'
  },
  lockIcon: {
    fontSize: '44px',
    marginBottom: '12px',
    filter: 'drop-shadow(0 0 10px rgba(99, 102, 241, 0.5))'
  },
  title: {
    fontSize: '26px',
    fontWeight: 700,
    margin: '0 0 6px 0',
    background: 'linear-gradient(135deg, #f8fafc 0%, #a5b4fc 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    letterSpacing: '-0.5px'
  },
  subtitle: {
    fontSize: '13px',
    color: '#64748b',
    margin: 0
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    borderRadius: '8px',
    padding: '10px 14px',
    marginBottom: '18px',
    textAlign: 'left'
  },
  errorText: {
    color: '#ef4444',
    fontSize: '13px',
    margin: 0,
    lineHeight: 1.4
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    textAlign: 'left'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  label: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#94a3b8',
    letterSpacing: '0.5px',
    textTransform: 'uppercase'
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    fontSize: '14px',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    color: '#f8fafc',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s ease'
  },
  submitButton: {
    width: '100%',
    padding: '13px',
    marginTop: '6px',
    backgroundColor: '#6366f1',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    margin: '18px 0 16px 0'
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)'
  },
  dividerText: {
    padding: '0 12px',
    fontSize: '11px',
    color: '#64748b',
    fontWeight: 600
  },
  googleButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '44px',
    backgroundColor: '#ffffff',
    color: '#1e293b',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
  },
  googleSvg: {
    width: '18px',
    height: '18px',
    marginRight: '10px'
  },
  bypassButton: {
    backgroundColor: 'transparent',
    color: '#a5b4fc',
    border: '1px solid rgba(165, 180, 252, 0.2)',
    borderRadius: '6px',
    padding: '8px 14px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    width: '100%'
  },
  footer: {
    marginTop: '24px',
    fontSize: '11px',
    color: '#64748b',
    lineHeight: 1.4
  },
  floatingHeader: {
    position: 'fixed',
    top: '12px',
    right: '12px',
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 22, 38, 0.85)',
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
  sessionTag: {
    color: '#34d399',
    marginLeft: '6px',
    fontSize: '11px',
    fontWeight: 600
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
