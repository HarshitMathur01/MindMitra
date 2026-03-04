import { motion } from 'framer-motion';
import { Mail, Key, Link2, Crown, LogOut, MessageSquare, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

interface AccountSettingsProps {
    loading: boolean;
}

export function AccountSettings({ loading }: AccountSettingsProps) {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();

    const maskedEmail = user?.email
        ? user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3')
        : 'Not available';

    const handleLogout = async () => {
        await signOut();
        navigate('/auth');
    };

    const handleContactSupport = () => {
        window.open('mailto:support@mindmitra.in?subject=Support Request', '_blank');
    };

    if (loading) {
        return (
            <div className="space-y-6">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-8 w-24 rounded-lg" />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
        >
            <div className="space-y-1">
                <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    Account
                </h3>
                <p className="text-xs text-text-secondary">
                    Manage your account details and preferences
                </p>
            </div>

            {/* Email */}
            <div className="flex items-center justify-between p-4 bg-background/50 rounded-xl border border-border/50">
                <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-text-secondary" />
                    <div>
                        <p className="text-sm font-medium text-text-primary">Email</p>
                        <p className="text-xs text-text-secondary font-mono">{maskedEmail}</p>
                    </div>
                </div>
                <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
                    Verified
                </Badge>
            </div>

            {/* Change Password */}
            <div className="flex items-center justify-between p-4 bg-background/50 rounded-xl border border-border/50">
                <div className="flex items-center gap-3">
                    <Key className="h-4 w-4 text-text-secondary" />
                    <div>
                        <p className="text-sm font-medium text-text-primary">Password</p>
                        <p className="text-xs text-text-secondary">Last changed: Unknown</p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl border-border hover:border-primary/30 text-xs"
                >
                    Change
                </Button>
            </div>

            {/* Linked Accounts */}
            <div className="p-4 bg-background/50 rounded-xl border border-border/50 space-y-3">
                <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-text-secondary" />
                    <p className="text-sm font-medium text-text-primary">Linked Accounts</p>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded bg-surface flex items-center justify-center">
                                <svg className="h-4 w-4" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                            </div>
                            <span className="text-sm text-text-primary">Google</span>
                        </div>
                        <Badge
                            variant="secondary"
                            className={`text-xs ${user?.app_metadata?.provider === 'google'
                                    ? 'bg-success/10 text-success'
                                    : 'bg-muted text-muted-foreground'
                                }`}
                        >
                            {user?.app_metadata?.provider === 'google' ? 'Connected' : 'Not linked'}
                        </Badge>
                    </div>

                    <div className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded bg-surface flex items-center justify-center text-xs">📱</div>
                            <span className="text-sm text-text-primary">Phone</span>
                        </div>
                        <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs">
                            Not linked
                        </Badge>
                    </div>
                </div>
            </div>

            {/* Subscription */}
            <div className="flex items-center justify-between p-4 bg-background/50 rounded-xl border border-border/50">
                <div className="flex items-center gap-3">
                    <Crown className="h-4 w-4 text-warning" />
                    <div>
                        <p className="text-sm font-medium text-text-primary">Subscription Plan</p>
                        <p className="text-xs text-text-secondary">Access level and features</p>
                    </div>
                </div>
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                    Free
                </Badge>
            </div>

            <Separator className="bg-border" />

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
                <Button
                    variant="outline"
                    onClick={handleLogout}
                    className="rounded-xl border-border hover:border-danger/30 hover:bg-danger/5 hover:text-danger gap-2 transition-all duration-200"
                >
                    <LogOut className="h-4 w-4" />
                    Logout
                </Button>

                <Button
                    variant="outline"
                    onClick={handleContactSupport}
                    className="rounded-xl border-border hover:border-primary/30 gap-2 transition-all duration-200"
                >
                    <MessageSquare className="h-4 w-4" />
                    Contact Support
                </Button>
            </div>
        </motion.div>
    );
}
