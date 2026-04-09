import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Chrome, Shield, Heart, Sparkles, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('signin');
  const { signIn, signUp, signInWithGoogle, user } = useAuth();
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await signIn(email, password);
    if (!error) navigate('/');
    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await signUp(email, password);
    setIsLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    await signInWithGoogle();
  };

  const trustBadges = [
    { icon: Shield, label: '100% Anonymous', desc: 'Your identity stays private' },
    { icon: Heart, label: 'No Judgement', desc: 'Safe space for honest conversations' },
    { icon: Sparkles, label: 'AI-Powered', desc: 'Evidence-based therapeutic support' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <div className="flex min-h-screen">
        {/* ── Left Panel — Brand / Illustration (hidden on mobile) ── */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="hidden lg:flex lg:w-[48%] relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, hsl(188, 51%, 38%) 0%, hsl(168, 38%, 42%) 50%, hsl(188, 45%, 30%) 100%)',
          }}
        >
          {/* Decorative circles */}
          <div className="absolute inset-0 overflow-hidden">
            <motion.div
              animate={{ y: [0, -15, 0], scale: [1, 1.05, 1] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute top-[10%] left-[10%] w-64 h-64 rounded-full bg-white/[0.06]"
            />
            <motion.div
              animate={{ y: [0, 12, 0], scale: [1, 0.97, 1] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
              className="absolute bottom-[15%] right-[5%] w-80 h-80 rounded-full bg-white/[0.04]"
            />
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
              className="absolute top-[50%] left-[60%] w-40 h-40 rounded-full bg-white/[0.05]"
            />
          </div>

          {/* Content */}
          <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <img src="/favicon.png" alt="MindMitra" className="w-8 h-8 object-contain" />
              </div>
              <span className="text-xl font-bold tracking-tight">MindMitra</span>
            </motion.div>

            {/* Center illustration area */}
            <div className="flex-1 flex flex-col items-center justify-center py-8">
              {/* Meditation illustration - CSS art */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5, duration: 0.7, ease: 'easeOut' }}
                className="relative mb-10"
              >
                {/* Breathing circle animation */}
                <motion.div
                  animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.5, 0.3] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-48 h-48 rounded-full bg-white/10 flex items-center justify-center"
                >
                  <motion.div
                    animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.6, 0.4] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                    className="w-36 h-36 rounded-full bg-white/15 flex items-center justify-center"
                  >
                    <motion.div
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
                      className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center"
                    >
                      <Heart className="w-10 h-10 text-white/80" />
                    </motion.div>
                  </motion.div>
                </motion.div>
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.5 }}
                className="text-3xl font-bold text-center leading-tight mb-4 max-w-sm"
              >
                Your safe space 
                <br />
                <span className="text-white/80">to feel, heal & grow</span>
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, duration: 0.5 }}
                className="text-white/60 text-center max-w-xs text-sm leading-relaxed"
              >
                An AI psychology companion crafted for Indian youth. 
                No judgement. No waiting. Just genuine support when you need it.
              </motion.p>
            </div>

            {/* Trust badges at bottom */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1, duration: 0.5 }}
              className="flex gap-6 justify-center"
            >
              {trustBadges.map((badge, i) => (
                <div key={i} className="flex items-center gap-2 text-white/70">
                  <badge.icon className="w-4 h-4" />
                  <span className="text-xs font-medium">{badge.label}</span>
                </div>
              ))}
            </motion.div>
          </div>
        </motion.div>

        {/* ── Right Panel — Auth Form ── */}
        <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
            className="w-full max-w-md"
          >
            {/* Mobile logo (hidden on desktop) */}
            <div className="lg:hidden text-center mb-8">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 overflow-hidden hover-glow">
                <img src="/favicon.png" alt="MindMitra" className="w-14 h-14 object-contain" />
              </div>
              <h1 className="text-2xl font-bold gradient-primary bg-clip-text text-transparent">
                MindMitra
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Your AI Psychology Companion
              </p>
            </div>

            {/* Heading */}
            <div className="mb-8">
              <motion.h1
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.4 }}
                className="text-2xl sm:text-3xl font-bold text-foreground"
              >
                {activeTab === 'signin' ? 'Welcome back' : 'Join MindMitra'}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.4 }}
                className="text-muted-foreground mt-2 text-sm"
              >
                {activeTab === 'signin'
                  ? 'Continue your wellness journey'
                  : 'Start your path to better mental wellness'}
              </motion.p>
            </div>

            {/* Google Sign-in (prominent CTA) */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
            >
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 text-sm font-medium border-border/60 hover:bg-accent/50 transition-smooth group"
                onClick={handleGoogleSignIn}
                disabled={isLoading || isGoogleLoading}
              >
                <svg className="mr-2.5 h-5 w-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                {isGoogleLoading ? 'Connecting...' : 'Continue with Google'}
              </Button>
            </motion.div>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/50" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-background px-3 text-xs text-muted-foreground uppercase tracking-wider">
                  or use email
                </span>
              </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 h-11 bg-muted/50 rounded-xl">
                <TabsTrigger
                  value="signin"
                  className="text-sm font-medium rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-xs transition-all duration-200"
                >
                  Sign In
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  className="text-sm font-medium rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-xs transition-all duration-200"
                >
                  Sign Up
                </TabsTrigger>
              </TabsList>

              <AnimatePresence mode="wait">
                <TabsContent value="signin" key="signin">
                  <motion.form
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.25 }}
                    onSubmit={handleSignIn}
                    className="space-y-4"
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor="signin-email" className="text-sm font-medium text-foreground">
                        Email
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signin-email"
                          type="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="pl-10 h-11 transition-smooth"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="signin-password" className="text-sm font-medium text-foreground">
                        Password
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signin-password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Enter your password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className="pl-10 pr-10 h-11 transition-smooth"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-11 gradient-primary hover-glow text-white font-medium transition-all duration-200 active:scale-[0.98]"
                      disabled={isLoading || isGoogleLoading}
                    >
                      {isLoading ? (
                        <motion.span animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>
                          Signing in…
                        </motion.span>
                      ) : (
                        <>Sign In <ArrowRight className="ml-2 h-4 w-4" /></>
                      )}
                    </Button>
                  </motion.form>
                </TabsContent>

                <TabsContent value="signup" key="signup">
                  <motion.form
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.25 }}
                    onSubmit={handleSignUp}
                    className="space-y-4"
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-email" className="text-sm font-medium text-foreground">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="signup-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="pl-10 h-11 transition-all duration-200" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="signup-password" className="text-sm font-medium text-foreground">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="signup-password" type={showPassword ? 'text' : 'password'} placeholder="At least 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="pl-10 pr-10 h-11 transition-all duration-200" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-11 gradient-primary hover-glow text-white font-medium transition-all duration-200 active:scale-[0.98]"
                      disabled={isLoading || isGoogleLoading}
                    >
                      {isLoading ? (
                        <motion.span animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>
                          Creating account…
                        </motion.span>
                      ) : (
                        <>Create Account <ArrowRight className="ml-2 h-4 w-4" /></>
                      )}
                    </Button>
                  </motion.form>
                </TabsContent>
              </AnimatePresence>
            </Tabs>

            {/* Skip auth */}
            <div className="mt-6">
              <Button
                type="button"
                variant="ghost"
                className="w-full text-muted-foreground hover:text-foreground text-sm font-normal transition-smooth"
                onClick={() => navigate('/')}
              >
                Continue without signing in
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Mobile trust badges */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              className="lg:hidden mt-8 flex flex-wrap gap-4 justify-center"
            >
              {trustBadges.map((badge, i) => (
                <div key={i} className="flex items-center gap-1.5 text-muted-foreground">
                  <badge.icon className="w-3.5 h-3.5" />
                  <span className="text-xs">{badge.label}</span>
                </div>
              ))}
            </motion.div>

            {/* Legal footer */}
            <p className="text-center text-xs text-muted-foreground mt-6">
              By continuing, you agree to our terms of service and privacy policy.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Auth;