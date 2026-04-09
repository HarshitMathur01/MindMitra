import { useState, useEffect, useRef, useCallback } from "react";
import Header from "@/components/layout/Header";
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

// ─── Constants ────────────────────────────────────────────────────────────────

const categories = [
    { id: "all", label: "✨ All", color: "primary" },
    { id: "exam-stress", label: "📚 Exam Stress", color: "amber" },
    { id: "family-pressure", label: "🏠 Family Pressure", color: "violet" },
    { id: "loneliness", label: "💙 Loneliness", color: "blue" },
    { id: "anxiety", label: "🌪️ Anxiety", color: "teal" },
    { id: "motivation", label: "🔥 Motivation", color: "orange" },
    { id: "hostel-life", label: "🏢 Hostel Life", color: "pink" },
    { id: "relationships", label: "💛 Relationships", color: "yellow" },
    { id: "wins", label: "🎉 Small Wins", color: "green" },
    { id: "jee-neet", label: "🎯 JEE/NEET", color: "red" },
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
        "bg-teal-500", "bg-primary", "bg-violet-500", "bg-amber-500",
        "bg-pink-500", "bg-green-500", "bg-orange-500", "bg-red-400",
    ];
    return colors[Math.abs(hash) % colors.length];
}

// ─── Category color map ───────────────────────────────────────────────────────

const categoryColorMap: Record<string, { bg: string; text: string; border: string; activeBg: string }> = {
    primary: { bg: "bg-primary/10", text: "text-primary", border: "border-primary/30", activeBg: "bg-primary" },
    amber: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/30", activeBg: "bg-amber-500" },
    violet: { bg: "bg-violet-500/10", text: "text-violet-600 dark:text-violet-400", border: "border-violet-500/30", activeBg: "bg-violet-500" },
    blue: { bg: "bg-primary/10", text: "text-primary", border: "border-primary/30", activeBg: "bg-primary" },
    teal: { bg: "bg-teal-500/10", text: "text-teal-600 dark:text-teal-400", border: "border-teal-500/30", activeBg: "bg-teal-500" },
    orange: { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", border: "border-orange-500/30", activeBg: "bg-orange-500" },
    pink: { bg: "bg-pink-500/10", text: "text-pink-600 dark:text-pink-400", border: "border-pink-500/30", activeBg: "bg-pink-500" },
    yellow: { bg: "bg-yellow-500/10", text: "text-yellow-600 dark:text-yellow-400", border: "border-yellow-500/30", activeBg: "bg-yellow-500" },
    green: { bg: "bg-green-500/10", text: "text-green-600 dark:text-green-400", border: "border-green-500/30", activeBg: "bg-green-500" },
    red: { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", border: "border-red-500/30", activeBg: "bg-red-500" },
};

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

function getCategoryColor(colorKey: string) {
    return categoryColorMap[colorKey] ?? categoryColorMap.primary;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// Stat pill
const StatPill = ({ icon: Icon, text }: { icon: React.ElementType; text: string }) => (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface/80 backdrop-blur-sm border border-border/50 text-sm text-muted-foreground"
    >
        <Icon className="h-4 w-4 text-primary" />
        <span>{text}</span>
    </motion.div>
);

// Post type badge
const PostTypeBadge = ({ type }: { type: PostType }) => {
    const config = {
        story: { label: "Story", className: "bg-primary/10 text-primary" },
        question: { label: "? Question", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
        win: { label: "🎉 Win!", className: "bg-green-500/10 text-green-600 dark:text-green-400" },
        vent: { label: "💙 Just listen", className: "bg-primary/10 text-primary" },
    };
    const c = config[type];
    return <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${c.className}`}>{c.label}</span>;
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
        onClick={onClick}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all duration-200 ${active
                ? "bg-primary/15 text-primary font-semibold scale-105"
                : "bg-surface hover:bg-primary/10 text-muted-foreground border border-border/50"
            }`}
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
    const catColors = getCategoryColor(catMeta?.color ?? "primary");
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
                className={`p-5 rounded-2xl border transition-all duration-200 hover:shadow-lg ${isWin
                        ? "border-green-400/40 bg-green-500/5"
                        : "border-border/60 bg-surface"
                    }`}
                style={{ boxShadow: "0 2px 16px var(--shadow)" }}
            >
                {/* Header */}
                <div className="flex items-start gap-3 mb-3">
                    <AnonAvatar name={post.anonymous_name} />

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-foreground text-sm">{post.anonymous_name}</span>
                            <span className="text-xs text-muted-foreground">{timeAgo(post.created_at)}</span>
                        </div>

                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {catMeta && (
                                <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full ${catColors.bg} ${catColors.text}`}>
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
                    <h3 className="font-bold text-foreground text-base mb-2 leading-snug">{post.title}</h3>
                )}

                {/* Content */}
                <div className="text-muted-foreground text-sm leading-relaxed mb-4">
                    {isLong && !expanded ? (
                        <>
                            {post.content.slice(0, 200)}...
                            <button
                                onClick={() => setExpanded(true)}
                                className="ml-1 text-primary font-medium hover:underline"
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
                            className="ml-1 text-primary font-medium hover:underline"
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
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs bg-surface hover:bg-primary/10 text-muted-foreground border border-border/50 transition-colors ml-auto"
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
            <DialogContent className="max-w-lg max-h-[85vh] flex flex-col bg-surface border-border/60 rounded-2xl p-0 overflow-hidden">
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
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-surface border-border/60 rounded-2xl">
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
    const navigate = useNavigate();
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
        <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
            <Header />

            {/* ─── HERO SECTION ──────────────────────────────────────────── */}
            <section className="relative overflow-hidden">
                {/* Soft teal gradient background */}
                <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-primary/3 to-transparent" />
                <div className="absolute top-10 left-1/4 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 right-1/4 w-56 h-56 bg-accent/5 rounded-full blur-3xl" />

                <div className="container mx-auto px-4 pt-16 pb-12 relative z-10">
                    <motion.div
                        className="text-center max-w-2xl mx-auto"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 leading-tight">
                            You're Not Alone
                        </h1>
                        <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                            Connect with students who truly get it — the pressure, the expectations, the late nights.
                        </p>

                        <div className="flex items-center justify-center gap-3 mb-8 flex-wrap">
                            <Button
                                onClick={() => setComposerOpen(true)}
                                className="rounded-xl bg-primary hover:bg-primary/90 text-white h-11 px-6 font-semibold"
                            >
                                <PenLine className="h-4 w-4 mr-2" />
                                Share Your Story
                            </Button>
                            <Button
                                variant="outline"
                                onClick={scrollToFeed}
                                className="rounded-xl border-border/60 text-muted-foreground hover:bg-primary/5 h-11 px-6"
                            >
                                Browse Stories
                            </Button>
                        </div>

                        <div className="flex items-center justify-center gap-3 flex-wrap">
                            <StatPill icon={Users} text="2,400+ students supported" />
                            <StatPill icon={Shield} text="Anonymous & Safe" />
                            <StatPill icon={Sparkles} text="Moderated 24/7" />
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ─── CATEGORIES ────────────────────────────────────────────── */}
            <section className="sticky top-[73px] z-40 bg-background/95 backdrop-blur-md border-b border-border/40 py-3">
                <div className="container mx-auto px-4">
                    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
                        {categories.map((cat) => {
                            const isActive = activeCategory === cat.id;
                            const colors = getCategoryColor(cat.color);
                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => { setActiveCategory(cat.id); setVisibleCount(10); }}
                                    className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border ${isActive
                                            ? `${colors.activeBg} text-white border-transparent shadow-md`
                                            : `bg-transparent ${colors.text} ${colors.border} hover:${colors.bg}`
                                        }`}
                                >
                                    {cat.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ─── FEED ──────────────────────────────────────────────────── */}
            <section ref={feedRef} className="container mx-auto px-4 py-8">
                {/* Sort + search bar */}
                <div className="flex items-center gap-3 mb-6 flex-wrap">
                    <div className="flex items-center gap-1 bg-surface rounded-xl border border-border/50 p-1">
                        {sortOptions.map((opt) => (
                            <button
                                key={opt.id}
                                onClick={() => setSortBy(opt.id)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${sortBy === opt.id
                                        ? "bg-primary/15 text-primary"
                                        : "text-muted-foreground hover:bg-primary/5"
                                    }`}
                            >
                                <opt.icon className="h-3.5 w-3.5" />
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    <div className="relative flex-1 max-w-xs ml-auto">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                        <Input
                            placeholder="Search stories..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 rounded-xl bg-surface border-border/50 text-sm h-9"
                        />
                    </div>
                </div>

                {/* Posts */}
                <div className="grid gap-4 max-w-2xl mx-auto">
                    <AnimatePresence mode="popLayout">
                        {visiblePosts.map((post) => (
                            <PostCard key={post.id} post={post} onOpenReplies={(p) => setReplyPost(p)} />
                        ))}
                    </AnimatePresence>

                    {visiblePosts.length === 0 && (
                        <div className="text-center py-16">
                            <p className="text-muted-foreground text-lg mb-2">No posts found</p>
                            <p className="text-muted-foreground/70 text-sm">Be the first to share in this category!</p>
                            <Button
                                onClick={() => setComposerOpen(true)}
                                className="mt-4 rounded-xl bg-primary hover:bg-primary/90 text-white"
                            >
                                <PenLine className="h-4 w-4 mr-2" />
                                Share Your Story
                            </Button>
                        </div>
                    )}

                    {visibleCount < filteredPosts.length && (
                        <div className="text-center py-4">
                            <Button variant="outline" onClick={loadMore} className="rounded-xl border-border/50">
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

            <Footer />
        </div>
    );
};

export default PeerSupport;
