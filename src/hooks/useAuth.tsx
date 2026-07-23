import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import {
  identifyProductAnalyticsUser,
  resetProductAnalyticsIdentity,
  trackProductEvent,
} from '@/lib/productAnalytics';
import { clearUserSessionData } from '@/lib/sessionCleanup';

// Swept on sign-out by sessionCleanup (mm_ prefix) — intended: on a shared
// device the marker must not outlive the account that set it.
const OAUTH_SIGNUP_TRACKED_KEY = 'mm_analytics_oauth_signup_tracked';

/**
 * `signup_completed` for OAuth flows. Supabase emits the same SIGNED_IN for
 * first-ever and returning OAuth logins, so treat "last sign-in within 5 min
 * of account creation" as account creation. Email signups are tracked
 * directly in signUp() and excluded here via app_metadata.provider.
 */
function maybeTrackOAuthSignupCompleted(user: User): void {
  try {
    const provider = user.app_metadata?.provider;
    if (!provider || provider === 'email') return;
    if (localStorage.getItem(OAUTH_SIGNUP_TRACKED_KEY) === user.id) return;
    const created = Date.parse(user.created_at);
    const lastSignIn = Date.parse(user.last_sign_in_at ?? user.created_at);
    if (!Number.isFinite(created) || !Number.isFinite(lastSignIn)) return;
    if (lastSignIn - created > 5 * 60_000) return;
    localStorage.setItem(OAUTH_SIGNUP_TRACKED_KEY, user.id);
    trackProductEvent('signup_completed', { method: provider });
  } catch {
    // analytics must never affect auth
  }
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  /** Supabase recovery email; add `${origin}/auth` to Supabase redirect URLs. */
  resetPasswordForEmail: (email: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        if (event === 'SIGNED_IN' && session?.user) {
          // Deferred: supabase-js warns against issuing client calls from
          // inside this callback, and trackProductEvent reads the session.
          const signedInUser = session.user;
          setTimeout(() => maybeTrackOAuthSignupCompleted(signedInUser), 0);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    identifyProductAnalyticsUser(user?.id ?? null);
  }, [user?.id]);

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Sign Up Error",
        description: error.message
      });
    } else {
      // Account created (confirmation may still be pending). No Supabase
      // session exists yet, so this lands in Mixpanel keyed to the device
      // and is stitched to the user by identify() after first sign-in.
      trackProductEvent('signup_completed', { method: 'email' });
      toast({
        title: "Success!",
        description: "Please check your email to confirm your account."
      });
    }

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Sign In Error",
        description: error.message
      });
    } else {
      toast({
        title: "Welcome back!",
        description: "You've successfully signed in."
      });
    }

    return { error };
  };

  const signInWithGoogle = async () => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl
      }
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Google Sign In Error",
        description: error.message
      });
    }

    return { error };
  };

  const resetPasswordForEmail = async (email: string) => {
    const redirectTo = `${window.location.origin}/auth`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) {
      toast({
        variant: "destructive",
        title: "Reset link failed",
        description: error.message,
      });
    } else {
      toast({
        title: "Check your inbox",
        description:
          "If an account exists for that email, you’ll get a reset link shortly.",
      });
    }
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        variant: "destructive",
        title: "Sign Out Error",
        description: error.message
      });
      return;
    }
    // Order matters: reset analytics identity FIRST so any in-flight
    // events still attached to this user don't leak after the wipe;
    // then sweep all user-scoped local state so the next person on a
    // shared device cannot read kept moments, MindGym streaks, journal
    // drafts, etc. See src/lib/sessionCleanup.ts for the allow-list.
    resetProductAnalyticsIdentity();
    clearUserSessionData();
    toast({
      title: "Signed out",
      description: "You've been successfully signed out."
    });
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    resetPasswordForEmail,
    signOut
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};