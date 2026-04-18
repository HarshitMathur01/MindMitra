import { useState, useEffect, useRef, useCallback } from "react";
import { AppShell } from "@/components/app/AppShell";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
    Flag,
    MessageCircle,
    PenLine,
    ChevronDown,
    Sparkles,
    Shield,
    Users,
    Clock,
    TrendingUp,
    Search,
    ArrowLeft,
    Send,
    Heart,
    X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const categories = [
    { id: "all", label: "✨ All" },
    { id: "exam-stress", label: "📚 Exam stress" },
    { id: "family-pressure", label: "🏠 Family pressure" },
    { id: "loneliness", label: "💙 Loneliness" },
    { id: "anxiety", label: "🌪️ Anxiety" },
    { id: "motivation", label: "🔥 Motivation" },
    { id: "hostel-life", label: "🏢 Hostel life" },
    { id: "relationships", label: "💛 Relationships" },
    { id: "wins", label: "🎉 Small wins" },
    { id: "jee-neet", label: "🎯 JEE / NEET" },
] as const;

type CategoryId = (typeof categories)[number]["id"];

const postTypes = [
    { id: "story", label: "Story", icon: "📖", description: "Share an experience" },
    { id: "question", label: "Question", icon: "❓", description: "Ask for advice" },
    { id: "win", label: "Small Win", icon: "🎉", description: "Celebrate something" },
    { id: "vent", label: "Vent", icon: "💙", description: "Just need to be heard" },
] as const;

type PostType = (typeof postTypes)[number]["id"];

const emotions = [
    "anxious",
    "overwhelmed",
    "hopeful",
    "sad",
    "confused",
    "grateful",
] as const;

type Emotion = (typeof emotions)[number];

const sortOptions = [
    { id: "recent", label: "Recent", icon: Clock },
    { id: "most-supported", label: "Most Supported", icon: Heart },
    { id: "trending", label: "Trending", icon: TrendingUp },
] as const;

type SortOption = (typeof sortOptions)[number]["id"];

// ─── Anonymous name generator ─────────────────────────────────────────────────

const adjectives = [
    "Quiet", "Starlit", "Brave", "Gentle", "Silver", "Calm", "Warm",
    "Hopeful", "Bright", "Misty", "Serene", "Peaceful", "Kind", "Golden",
    "Curious", "Dream", "Soft", "Rising", "Tender", "Wild",
];
const nouns = [
    "Mountain", "Student", "River", "Moon", "Star", "Cloud", "Wave",
    "Forest", "Garden", "Phoenix", "Sunrise", "Breeze", "Pearl", "Lotus",
    "Horizon", "Ocean", "Meadow", "Storm", "Light", "Path",
];

function generateAnonName(seed: string): string {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = (hash << 5) - hash + seed.charCodeAt(i);
        hash |= 0;
    }
    const adj = adjectives[Math.abs(hash) % adjectives.length];
    const noun = nouns[Math.abs(hash >> 8) % nouns.length];
    const num = Math.abs(hash % 100);
    return `${adj}${noun}${num}`;
}

function generateAvatarColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
        "bg-[hsl(var(--accent-500))]",
        "bg-[hsl(var(--accent-600))]",
        "bg-[hsl(var(--warmth-500))]",
        "bg-[hsl(var(--accent-500))]/90",
        "bg-[hsl(var(--warmth-400))]",
        "bg-[hsl(var(--accent-600))]/95",
        "bg-[hsl(var(--warmth-500))]/90",
        "bg-[hsl(var(--accent-500))]",
    ];
    return colors[Math.abs(hash) % colors.length];
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PeerPost {
    id: string;
    user_id: string;
    anonymous_name: string;
    category: CategoryId;
    post_type: PostType;
    emotion: Emotion;
    title: string;
    content: string;
    reactions: { feel: number; strong: number; support: number };
    reply_count: number;
    created_at: string;
}

interface PostReply {
    id: string;
    post_id: string;
    user_id: string;
    anonymous_name: string;
    content: string;
    created_at: string;
}

// ─── Mock data generator ──────────────────────────────────────────────────────

function generateMockPosts(): PeerPost[] {
    const mockData: Omit<PeerPost, "id" | "anonymous_name" | "reactions" | "reply_count" | "created_at" | "user_id">[] = [
        { category: "exam-stress", post_type: "story", emotion: "overwhelmed", title: "Board exams are crushing me", content: "I've been studying 14 hours a day for the past 3 months. My parents keep comparing me to my cousin who got into IIT. I feel like no matter how much I study, it's never enough. Yesterday I broke down crying in the middle of solving a physics problem. I just want someone to tell me it's okay to not be perfect." },
        { category: "loneliness", post_type: "vent", emotion: "sad", title: "Nobody notices when I'm not okay", content: "Moved to a new city for college. I smile all day, sit in the canteen with people, laugh at jokes. But when I go back to my hostel room at night, the silence is deafening. I haven't had a real conversation with anyone in weeks. Not the kind where someone actually asks how you are and means it." },
        { category: "wins", post_type: "win", emotion: "grateful", title: "I finally asked for help today!", content: "After months of struggling with anxiety attacks before every presentation, I finally went to the college counselor. She was SO kind. I cried the whole session and she just listened. I feel lighter already. If you're reading this and hesitating to seek help — please go. You deserve support. 💚" },
        { category: "anxiety", post_type: "question", emotion: "anxious", title: "How do you deal with Sunday anxiety?", content: "Every Sunday evening I get this crushing dread about Monday. My heart races, I can't eat, and I keep thinking of all the things that could go wrong in the week. Does anyone else experience this? What helps you cope? I've tried deep breathing but it doesn't seem enough." },
        { category: "family-pressure", post_type: "story", emotion: "confused", title: "Papa wants me to be a doctor but I love art", content: "My father has been saving for my medical coaching since I was 12. I don't have it in me to tell him that I spend every free moment sketching and painting. I'm good at biology but my heart isn't in it. How do I choose between making my family proud and following my passion?" },
        { category: "jee-neet", post_type: "vent", emotion: "overwhelmed", title: "Failed JEE Mains for the third time", content: "Everyone around me is moving forward. Getting into colleges, making friends, living their lives. And here I am, still stuck in Kota, still solving the same problems, still feeling like a failure. My coaching sir says I have potential but I'm starting to doubt everything. I just needed to write this somewhere." },
        { category: "motivation", post_type: "story", emotion: "hopeful", title: "From 40% to 85% — My comeback story", content: "Last year at this time, I was failing in most subjects. I had lost all motivation and spent days in bed watching reels. Then something clicked — I stopped comparing myself to toppers and just focused on being 1% better each day. Small improvements. Tiny steps. Today I got my results and I couldn't believe my eyes." },
        { category: "hostel-life", post_type: "question", emotion: "anxious", title: "How to deal with toxic roommates?", content: "My roommate has been spreading rumors about me to the entire floor. I don't want to create drama but it's affecting my mental peace. I can't concentrate on studies and I dread going back to my room. Has anyone dealt with something similar? Should I talk to the warden?" },
        { category: "relationships", post_type: "vent", emotion: "sad", title: "Lost my best friend over a misunderstanding", content: "We were inseparable for 4 years. Then one stupid argument over something so trivial, and she hasn't spoken to me in 3 months. I've apologized. I've tried reaching out. Nothing. It hurts to see her laugh with others while I eat lunch alone. I miss her every single day." },
        { category: "exam-stress", post_type: "win", emotion: "grateful", title: "Said no to an exam I wasn't ready for", content: "For the first time in my life, I chose my mental health over a grade. I dropped one paper this semester because I knew I'd have a panic attack trying to prepare. My parents were upset, but my therapist said she was proud. Sometimes the bravest thing is knowing your limits." },
        { category: "anxiety", post_type: "story", emotion: "hopeful", title: "My breathing technique that actually works", content: "After trying dozens of anxiety hacks from YouTube, I found one that genuinely helps me. It's not the 4-7-8 technique everyone talks about. For me, what works is grounding — I touch 5 different textures around me and describe them. My desk, my bedsheet, a coin, my water bottle. By the time I'm done, my mind has quieted down." },
        { category: "loneliness", post_type: "story", emotion: "hopeful", title: "Found my tribe in the most unexpected place", content: "I was the quiet kid who never joined any club. Then our college started a birdwatching group (I know, sounds weird). I went once out of curiosity and met the most genuine, kind people. We now meet every Sunday morning. Sometimes connection finds you when you stop looking for it." },
    ];

    return mockData.map((post, idx) => ({
        ...post,
        id: `mock-${idx}`,
        user_id: `user-mock-${idx}`,
        anonymous_name: generateAnonName(`user-mock-${idx}`),
        reactions: {
            feel: Math.floor(Math.random() * 120) + 5,
            strong: Math.floor(Math.random() * 80) + 3,
            support: Math.floor(Math.random() * 60) + 2,
        },
        reply_count: Math.floor(Math.random() * 30) + 1,
        created_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    }));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return `${Math.floor(days / 7)}w ago`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// Stat pill
const StatPill = ({ icon: Icon, text }: { icon: React.ElementType; text: string }) => (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="inline-flex items-center gap-2 rounded-full border border-ink-3/40 bg-[hsl(var(--card))] px-4 py-2 text-sm text-ink-6 shadow-dashboard-soft backdrop-blur-sm dark:bg-[hsl(var(--ink-2))]/70"
    >
        <Icon className="h-4 w-4 text-[hsl(var(--accent-600))] dark:text-[hsl(var(--accent-400))]" strokeWidth={1.8} />
        <span>{text}</span>
    </motion.div>
);

// Post type badge
const PostTypeBadge = ({ type }: { type: PostType }) => {
    const config = {
        story: { label: "Story", className: "bg-[hsl(var(--accent-100))] text-[hsl(var(--accent-700))] dark:bg-[hsl(var(--accent-100))]/20 dark:text-[hsl(var(--accent-300))]" },
        question: { label: "Question", className: "bg-[hsl(var(--warmth-100))] text-[hsl(var(--warmth-600))] dark:bg-[hsl(var(--warmth-100))]/15 dark:text-[hsl(var(--warmth-400))]" },
        win: { label: "Win", className: "bg-[hsl(var(--accent-50))] text-[hsl(var(--accent-700))] dark:bg-[hsl(var(--accent-100))]/18 dark:text-[hsl(var(--accent-300))]" },
        vent: { label: "Listen", className: "bg-[hsl(var(--ink-1))] text-ink-7 dark:bg-[hsl(var(--ink-2))]/80 dark:text-ink-8" },
    };
    const c = config[type];
    return (
        <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", c.className)}>
            {c.label}
        </span>
    );
};

// Emotion badge
const EmotionBadge = ({ emotion }: { emotion: Emotion }) => {
    const emojiMap: Record<Emotion, string> = {
        anxious: "😰",
        overwhelmed: "😮‍💨",
        hopeful: "🌱",
        sad: "😔",
        confused: "🤔",
        grateful: "🙏",
    };
    return (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <span>{emojiMap[emotion]}</span>
            <span className="capitalize">Feeling {emotion}</span>
        </span>
    );
};

// Reaction button
const ReactionBtn = ({
    emoji,
    label,
    count,
    onClick,
    active,
}: {
    emoji: string;
    label: string;
    count: number;
    onClick: () => void;
    active: boolean;
}) => (
    <button
        type="button"
        onClick={onClick}
        className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-all duration-200",
            active
                ? "scale-[1.02] border-[hsl(var(--accent-400))]/40 bg-[hsl(var(--accent-100))] font-semibold text-[hsl(var(--accent-700))] dark:bg-[hsl(var(--accent-100))]/20 dark:text-[hsl(var(--accent-300))]"
                : "border-ink-3/40 bg-[hsl(var(--card))] text-ink-5 hover:border-ink-3/60 hover:bg-[hsl(var(--ink-1))] dark:bg-[hsl(var(--ink-2))]/60",
        )}
    >
        <span>{emoji}</span>
        <span className="hidden sm:inline">{label}</span>
        <span className="font-medium">{count}</span>
    </button>
);

// Anonymous avatar
const AnonAvatar = ({ name }: { name: string }) => {
    const colorClass = generateAvatarColor(name);
    const initials = name.slice(0, 2).toUpperCase();
    return (
        <div className={`w-10 h-10 rounded-full ${colorClass} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
            {initials}
        </div>
    );
};

// ─── Post Card ────────────────────────────────────────────────────────────────

const PostCard = ({
    post,
    onOpenReplies,
}: {
    post: PeerPost;
    onOpenReplies: (post: PeerPost) => void;
}) => {
    const [expanded, setExpanded] = useState(false);
    const [localReactions, setLocalReactions] = useState(post.reactions);
    const [activeReactions, setActiveReactions] = useState<Record<string, boolean>>({});
    const { toast } = useToast();

    const catMeta = categories.find((c) => c.id === post.category);
    const isLong = post.content.length > 200;
    const isWin = post.post_type === "win";

    const handleReaction = (key: "feel" | "strong" | "support") => {
        const already = activeReactions[key];
        setActiveReactions((prev) => ({ ...prev, [key]: !already }));
        setLocalReactions((prev) => ({
            ...prev,
            [key]: already ? prev[key] - 1 : prev[key] + 1,
        }));
    };

    const handleReport = () => {
        toast({ title: "Report submitted", description: "Our moderators will review this post. Thank you for keeping the community safe." });
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            <Card
                className={cn(
                    "rounded-[1.25rem] border p-5 shadow-dashboard-soft transition-all duration-200 hover:shadow-dashboard-warm",
                    isWin
                        ? "border-[hsl(var(--accent-300))]/50 bg-[hsl(var(--accent-50))] dark:border-[hsl(var(--accent-500))]/25 dark:bg-[hsl(var(--accent-100))]/12"
                        : "border-ink-3/40 bg-[hsl(var(--card))] dark:border-ink-3/30 dark:bg-[hsl(var(--ink-2))]",
                )}
            >
                {/* Header */}
                <div className="flex items-start gap-3 mb-3">
                    <AnonAvatar name={post.anonymous_name} />

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-ink-8">{post.anonymous_name}</span>
                            <span className="text-xs text-ink-5">{timeAgo(post.created_at)}</span>
                        </div>

                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {catMeta && (
                                <span className="inline-flex items-center rounded-full bg-[hsl(var(--ink-1))] px-2 py-0.5 text-xs font-medium text-ink-7 dark:bg-[hsl(var(--ink-2))]/80 dark:text-ink-8">
                                    {catMeta.label}
                                </span>
                            )}
                            <PostTypeBadge type={post.post_type} />
                            <EmotionBadge emotion={post.emotion} />
                        </div>
                    </div>

                    <button
                        onClick={handleReport}
                        className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-danger hover:bg-danger/10 transition-colors"
                        title="Report post"
                    >
                        <Flag className="h-4 w-4" />
                    </button>
                </div>

                {/* Title */}
                {post.title && (
                    <h3 className="mb-2 font-display text-base font-normal leading-snug text-ink-8">{post.title}</h3>
                )}

                {/* Content */}
                <div className="mb-4 text-sm leading-relaxed text-ink-6">
                    {isLong && !expanded ? (
                        <>
                            {post.content.slice(0, 200)}...
                            <button
                                onClick={() => setExpanded(true)}
                                className="ml-1 font-medium text-[hsl(var(--accent-600))] hover:underline dark:text-[hsl(var(--accent-400))]"
                            >
                                Read more
                            </button>
                        </>
                    ) : (
                        post.content
                    )}
                    {isLong && expanded && (
                        <button
                            onClick={() => setExpanded(false)}
                            className="ml-1 font-medium text-[hsl(var(--accent-600))] hover:underline dark:text-[hsl(var(--accent-400))]"
                        >
                            Show less
                        </button>
                    )}
                </div>

                {/* Reactions + replies */}
                <div className="flex items-center gap-2 flex-wrap">
                    <ReactionBtn emoji="🤍" label="I feel this" count={localReactions.feel} active={!!activeReactions.feel} onClick={() => handleReaction("feel")} />
                    <ReactionBtn emoji="💪" label="You've got this" count={localReactions.strong} active={!!activeReactions.strong} onClick={() => handleReaction("strong")} />
                    <ReactionBtn emoji="🫂" label="Sending support" count={localReactions.support} active={!!activeReactions.support} onClick={() => handleReaction("support")} />

                    <button
                        onClick={() => onOpenReplies(post)}
                        className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-ink-3/40 bg-[hsl(var(--ink-1))] px-3 py-1.5 text-xs text-ink-5 transition-colors hover:border-ink-3/60 hover:bg-[hsl(var(--ink-2))] dark:bg-[hsl(var(--ink-2))]/60"
                    >
                        <MessageCircle className="h-3.5 w-3.5" />
                        <span>{post.reply_count} replies</span>
                    </button>
                </div>
            </Card>
        </motion.div>
    );
};

// ─── Reply Drawer ─────────────────────────────────────────────────────────────

const ReplyDrawer = ({
    post,
    open,
    onClose,
}: {
    post: PeerPost | null;
    open: boolean;
    onClose: () => void;
}) => {
    const [replies, setReplies] = useState<PostReply[]>([]);
    const [replyText, setReplyText] = useState("");
    const { user } = useAuth();
    const { toast } = useToast();

    useEffect(() => {
        if (post) {
            // Generate mock replies
            const mockReplies: PostReply[] = Array.from({ length: Math.min(post.reply_count, 5) }, (_, i) => ({
                id: `reply-${post.id}-${i}`,
                post_id: post.id,
                user_id: `user-reply-${i}`,
                anonymous_name: generateAnonName(`user-reply-${i}-${post.id}`),
                content: [
                    "You're not alone in this. I went through something very similar last semester. It gets better, I promise. 💚",
                    "Thank you for sharing this. It takes real courage to be vulnerable, even anonymously. Wishing you strength.",
                    "I've been feeling the exact same way. It helps to know someone else understands.",
                    "Have you tried talking to your college counselor? Mine really helped me through a similar phase.",
                    "Sending you a virtual hug. Remember — one day at a time. 🌱",
                ][i % 5],
                created_at: new Date(Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000).toISOString(),
            }));
            setReplies(mockReplies);
        }
    }, [post]);

    const handleSendReply = () => {
        if (!replyText.trim()) return;
        if (!user) {
            toast({ title: "Sign in required", description: "Please sign in to reply." });
            return;
        }
        const newReply: PostReply = {
            id: `reply-${Date.now()}`,
            post_id: post?.id ?? "",
            user_id: user.id,
            anonymous_name: generateAnonName(user.id),
            content: replyText.trim(),
            created_at: new Date().toISOString(),
        };
        setReplies((prev) => [...prev, newReply]);
        setReplyText("");
        toast({ title: "Reply sent", description: "Your anonymous reply has been posted." });
    };

    if (!post) return null;

    return (
        <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
            <DialogContent className="max-w-lg w-[calc(100%-2rem)] max-h-[85vh] flex flex-col bg-surface border-border/60 rounded-2xl p-0 overflow-hidden">
                <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/40">
                    <DialogTitle className="text-base font-bold text-foreground line-clamp-1">{post.title}</DialogTitle>
                    <p className="text-xs text-muted-foreground mt-1">Replies to {post.anonymous_name}'s post</p>
                </DialogHeader>

                {/* Replies list */}
                <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
                    {post.post_type === "vent" && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 text-primary text-xs">
                            <Heart className="h-3.5 w-3.5" />
                            <span>This is a vent post — the person just wants to be heard. Please be supportive, not prescriptive.</span>
                        </div>
                    )}
                    {replies.map((reply) => (
                        <div key={reply.id} className="flex gap-3">
                            <AnonAvatar name={reply.anonymous_name} />
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-foreground">{reply.anonymous_name}</span>
                                    <span className="text-xs text-muted-foreground">{timeAgo(reply.created_at)}</span>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{reply.content}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Reply input */}
                <div className="px-5 py-3 border-t border-border/40">
                    <div className="flex gap-2">
                        <Input
                            placeholder="Write a supportive reply..."
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSendReply()}
                            className="flex-1 bg-background border-border/50 rounded-xl text-sm"
                        />
                        <Button size="sm" onClick={handleSendReply} className="rounded-xl bg-primary hover:bg-primary/90 text-white">
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

// ─── Composer Modal ───────────────────────────────────────────────────────────

const PostComposer = ({
    open,
    onClose,
    onSubmit,
}: {
    open: boolean;
    onClose: () => void;
    onSubmit: (post: Omit<PeerPost, "id" | "user_id" | "anonymous_name" | "reactions" | "reply_count" | "created_at">) => void;
}) => {
    const [postType, setPostType] = useState<PostType>("story");
    const [category, setCategory] = useState<CategoryId>("exam-stress");
    const [emotion, setEmotion] = useState<Emotion>("anxious");
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const { user } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();

    const maxLen = 2000;

    const handleSubmit = () => {
        if (!user) {
            toast({ title: "Sign in required", description: "Please sign in to share your story." });
            navigate("/auth");
            return;
        }
        if (!title.trim() || !content.trim()) {
            toast({ title: "Missing fields", description: "Please add a title and content." });
            return;
        }
        onSubmit({ title: title.trim(), content: content.trim(), category, post_type: postType, emotion });
        setTitle("");
        setContent("");
        setPostType("story");
        onClose();
        toast({ title: "Posted anonymously ✨", description: "Your story is now live. Your identity remains completely hidden." });
    };

    return (
        <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
            <DialogContent className="max-w-lg w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto bg-surface border-border/60 rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                        <PenLine className="h-5 w-5 text-primary" />
                        Share Anonymously
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                        Your identity is completely hidden. Be honest, be brave, be you.
                    </p>
                </DialogHeader>

                <div className="space-y-5 mt-2">
                    {/* Post type */}
                    <div>
                        <label className="text-sm font-medium text-foreground mb-2 block">What kind of post?</label>
                        <div className="grid grid-cols-2 gap-2">
                            {postTypes.map((pt) => (
                                <button
                                    key={pt.id}
                                    onClick={() => setPostType(pt.id)}
                                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-all border ${postType === pt.id
                                            ? "bg-primary/15 border-primary/40 text-primary font-semibold"
                                            : "bg-background border-border/50 text-muted-foreground hover:bg-primary/5"
                                        }`}
                                >
                                    <span>{pt.icon}</span>
                                    <div className="text-left">
                                        <div className="text-sm font-medium">{pt.label}</div>
                                        <div className="text-xs opacity-70">{pt.description}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Category */}
                    <div>
                        <label className="text-sm font-medium text-foreground mb-2 block">Category</label>
                        <Select value={category} onValueChange={(v) => setCategory(v as CategoryId)}>
                            <SelectTrigger className="rounded-xl bg-background border-border/50">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.filter((c) => c.id !== "all").map((c) => (
                                    <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Emotion */}
                    <div>
                        <label className="text-sm font-medium text-foreground mb-2 block">How are you feeling?</label>
                        <div className="flex flex-wrap gap-2">
                            {emotions.map((em) => (
                                <button
                                    key={em}
                                    onClick={() => setEmotion(em)}
                                    className={`px-3 py-1.5 rounded-full text-xs capitalize transition-all border ${emotion === em
                                            ? "bg-primary/15 border-primary/40 text-primary font-semibold"
                                            : "bg-background border-border/50 text-muted-foreground hover:bg-primary/5"
                                        }`}
                                >
                                    {em}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="text-sm font-medium text-foreground mb-2 block">Title</label>
                        <Input
                            placeholder="Give your post a title..."
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            maxLength={100}
                            className="rounded-xl bg-background border-border/50"
                        />
                    </div>

                    {/* Content */}
                    <div>
                        <label className="text-sm font-medium text-foreground mb-2 block">Your story</label>
                        <Textarea
                            placeholder={
                                postType === "vent"
                                    ? "Let it all out. This is a judgment-free space..."
                                    : postType === "question"
                                        ? "What's on your mind? The community is here to help..."
                                        : postType === "win"
                                            ? "Tell us about your win! No matter how small, it matters..."
                                            : "Share what you're going through. You'll be heard..."
                            }
                            value={content}
                            onChange={(e) => setContent(e.target.value.slice(0, maxLen))}
                            className="min-h-[140px] rounded-xl bg-background border-border/50 resize-none"
                        />
                        <p className="text-xs text-muted-foreground mt-1 text-right">{content.length}/{maxLen}</p>
                    </div>

                    {/* Privacy reminder */}
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20">
                        <Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <p className="text-xs text-muted-foreground">
                            Your post is <span className="font-semibold text-primary">100% anonymous</span>. No one can see your name, email, or profile. A random username will be assigned.
                        </p>
                    </div>

                    {/* Submit */}
                    <Button onClick={handleSubmit} className="w-full rounded-xl bg-primary hover:bg-primary/90 text-white h-11 text-sm font-semibold">
                        <PenLine className="h-4 w-4 mr-2" />
                        Post Anonymously
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const PeerSupport = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const feedRef = useRef<HTMLDivElement>(null);

    const [activeCategory, setActiveCategory] = useState<CategoryId>("all");
    const [sortBy, setSortBy] = useState<SortOption>("recent");
    const [composerOpen, setComposerOpen] = useState(false);
    const [replyPost, setReplyPost] = useState<PeerPost | null>(null);
    const [posts, setPosts] = useState<PeerPost[]>(() => generateMockPosts());
    const [searchQuery, setSearchQuery] = useState("");
    const [visibleCount, setVisibleCount] = useState(10);

    // Filter + sort posts
    const filteredPosts = posts
        .filter((p) => activeCategory === "all" || p.category === activeCategory)
        .filter((p) =>
            searchQuery
                ? p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.content.toLowerCase().includes(searchQuery.toLowerCase())
                : true
        )
        .sort((a, b) => {
            if (sortBy === "recent") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            if (sortBy === "most-supported") {
                const totalA = a.reactions.feel + a.reactions.strong + a.reactions.support;
                const totalB = b.reactions.feel + b.reactions.strong + b.reactions.support;
                return totalB - totalA;
            }
            // trending: combination of recency + reactions
            const ageA = (Date.now() - new Date(a.created_at).getTime()) / 3600000;
            const ageB = (Date.now() - new Date(b.created_at).getTime()) / 3600000;
            const scoreA = (a.reactions.feel + a.reactions.strong + a.reactions.support + a.reply_count * 2) / Math.pow(ageA + 2, 1.2);
            const scoreB = (b.reactions.feel + b.reactions.strong + b.reactions.support + b.reply_count * 2) / Math.pow(ageB + 2, 1.2);
            return scoreB - scoreA;
        });

    const visiblePosts = filteredPosts.slice(0, visibleCount);

    // Infinite scroll
    const loadMore = useCallback(() => {
        if (visibleCount < filteredPosts.length) {
            setVisibleCount((c) => Math.min(c + 10, filteredPosts.length));
        }
    }, [visibleCount, filteredPosts.length]);

    useEffect(() => {
        const onScroll = () => {
            if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 400) {
                loadMore();
            }
        };
        window.addEventListener("scroll", onScroll);
        return () => window.removeEventListener("scroll", onScroll);
    }, [loadMore]);

    const handleNewPost = (data: Omit<PeerPost, "id" | "user_id" | "anonymous_name" | "reactions" | "reply_count" | "created_at">) => {
        const newPost: PeerPost = {
            ...data,
            id: `post-${Date.now()}`,
            user_id: user?.id ?? "anon",
            anonymous_name: generateAnonName(user?.id ?? `anon-${Date.now()}`),
            reactions: { feel: 0, strong: 0, support: 0 },
            reply_count: 0,
            created_at: new Date().toISOString(),
        };
        setPosts((prev) => [newPost, ...prev]);
    };

    const scrollToFeed = () => {
        feedRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    return (
        <AppShell>
            <div className="mx-auto w-full max-w-6xl px-4 pb-28 sm:px-6 md:pb-12">
            {/* ─── HERO SECTION ──────────────────────────────────────────── */}
            <section className="relative overflow-hidden pt-10 md:pt-12">
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[hsl(var(--accent-50))]/50 via-transparent to-transparent dark:from-[hsl(var(--accent-500))]/5" />
                <div className="pointer-events-none absolute -left-20 top-0 h-56 w-56 rounded-full bg-[hsl(var(--accent-100))]/40 blur-3xl dark:bg-[hsl(var(--accent-500))]/10" />
                <div className="pointer-events-none absolute bottom-0 right-0 h-48 w-48 rounded-full bg-[hsl(var(--warmth-100))]/30 blur-3xl dark:bg-[hsl(var(--warmth-500))]/10" />

                <div className="relative z-10 mx-auto max-w-2xl text-center">
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
                        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink-5">Peer support</p>
                        <h1 className="mt-3 font-display text-4xl font-normal leading-tight tracking-tight text-ink-8 md:text-5xl">
                            You&apos;re not alone
                        </h1>
                        <p className="mt-4 text-lg leading-relaxed text-ink-5">
                            Stories, questions, and small wins from people who get the pressure — anonymous, gentle, moderated.
                        </p>

                        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                            <Button
                                type="button"
                                onClick={() => setComposerOpen(true)}
                                className="h-11 rounded-full bg-[hsl(var(--accent-500))] px-6 font-semibold text-white shadow-md hover:bg-[hsl(var(--accent-600))]"
                            >
                                <PenLine className="mr-2 h-4 w-4" strokeWidth={1.8} />
                                Share your story
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={scrollToFeed}
                                className="h-11 rounded-full border-ink-3/50 bg-[hsl(var(--card))] text-ink-7 shadow-dashboard-soft hover:bg-[hsl(var(--ink-1))]"
                            >
                                Browse feed
                            </Button>
                        </div>

                        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                            <StatPill icon={Users} text="2,400+ students supported" />
                            <StatPill icon={Shield} text="Anonymous & safe" />
                            <StatPill icon={Sparkles} text="Moderated community" />
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ─── CATEGORIES ────────────────────────────────────────────── */}
            <section className="sticky top-[var(--header-height)] z-30 border-b border-ink-3/30 bg-[hsl(var(--background))]/90 py-3 backdrop-blur-md supports-[backdrop-filter]:bg-[hsl(var(--background))]/75 dark:border-ink-3/25">
                <div className="flex items-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {categories.map((cat) => {
                        const isActive = activeCategory === cat.id;
                        return (
                            <button
                                type="button"
                                key={cat.id}
                                onClick={() => {
                                    setActiveCategory(cat.id);
                                    setVisibleCount(10);
                                }}
                                className={cn(
                                    "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200",
                                    isActive
                                        ? "border-transparent bg-[hsl(var(--accent-500))] text-white shadow-dashboard-soft"
                                        : "border-ink-3/40 bg-[hsl(var(--card))] text-ink-6 hover:border-ink-3/60 hover:bg-[hsl(var(--ink-1))] dark:bg-[hsl(var(--ink-2))]/60",
                                )}
                            >
                                {cat.label}
                            </button>
                        );
                    })}
                </div>
            </section>

            {/* ─── FEED ──────────────────────────────────────────────────── */}
            <section ref={feedRef} className="py-8">
                <div className="mb-8 flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1 rounded-2xl border border-ink-3/40 bg-[hsl(var(--ink-1))] p-1 dark:border-ink-3/30 dark:bg-[hsl(var(--ink-2))]/60">
                        {sortOptions.map((opt) => (
                            <button
                                type="button"
                                key={opt.id}
                                onClick={() => setSortBy(opt.id)}
                                className={cn(
                                    "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all",
                                    sortBy === opt.id
                                        ? "bg-[hsl(var(--card))] text-ink-8 shadow-dashboard-soft dark:bg-[hsl(var(--ink-2))]"
                                        : "text-ink-5 hover:bg-[hsl(var(--card))]/80 dark:hover:bg-[hsl(var(--ink-2))]",
                                )}
                            >
                                <opt.icon className="h-3.5 w-3.5" strokeWidth={1.8} />
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    <div className="relative ml-auto min-w-0 flex-1 max-w-xs">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-5" strokeWidth={1.8} />
                        <Input
                            placeholder="Search stories…"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-10 rounded-xl border-ink-3/50 bg-[hsl(var(--card))] pl-9 text-sm text-ink-8 placeholder:text-ink-5 dark:bg-[hsl(var(--ink-2))]/80"
                        />
                    </div>
                </div>

                {/* Posts */}
                <div className="mx-auto grid max-w-2xl gap-4">
                    <AnimatePresence mode="popLayout">
                        {visiblePosts.map((post) => (
                            <motion.div 
                                key={post.id}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                            >
                                <PostCard post={post} onOpenReplies={(p) => setReplyPost(p)} />
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {visiblePosts.length === 0 && (
                        <div className="text-center py-16">
                            <p className="text-muted-foreground text-lg mb-2">No posts found</p>
                            <p className="text-muted-foreground/70 text-sm">Be the first to share in this category!</p>
                            <Button
                                type="button"
                                onClick={() => setComposerOpen(true)}
                                className="mt-4 h-11 rounded-full bg-[hsl(var(--accent-500))] px-6 text-white hover:bg-[hsl(var(--accent-600))]"
                            >
                                <PenLine className="h-4 w-4 mr-2" />
                                Share Your Story
                            </Button>
                        </div>
                    )}

                    {visibleCount < filteredPosts.length && (
                        <div className="text-center py-4">
                            <Button type="button" variant="outline" onClick={loadMore} className="rounded-full border-ink-3/50">
                                <ChevronDown className="h-4 w-4 mr-2" />
                                Load more stories
                            </Button>
                        </div>
                    )}
                </div>
            </section>

            {/* ─── Modals ────────────────────────────────────────────────── */}
            <PostComposer open={composerOpen} onClose={() => setComposerOpen(false)} onSubmit={handleNewPost} />
            <ReplyDrawer post={replyPost} open={!!replyPost} onClose={() => setReplyPost(null)} />

            </div>
            <Footer />
        </AppShell>
    );
};

export default PeerSupport;
