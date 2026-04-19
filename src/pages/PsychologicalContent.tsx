import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/app/AppShell";
import { PageContainer } from "@/components/app/PageContainer";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import {
    Play,
    Headphones,
    FileText,
    Clock,
    Star,
    Search,
    Heart,
    ChevronRight,
    Brain,
    Sparkles,
    ArrowRight,
    Bookmark,
    BookmarkCheck,
    CheckCircle2,
    Users,
    Flower2,
    Activity,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { ease, duration, enterTransition } from "@/lib/motion";

// ─── Types ────────────────────────────────────────────────────────────────────

type ContentType = "article" | "video" | "audio" | "exercise";
type DifficultyLevel = "beginner" | "intermediate" | "advanced";

interface ContentItem {
    id: string;
    title: string;
    description: string;
    longDescription: string;
    type: ContentType;
    category: string;
    tags: string[];
    duration: string;
    difficulty: DifficultyLevel;
    author: string;
    authorCredential: string;
    rating: number;
    readCount: number;
    imageEmoji: string;
    featured: boolean;
    keyTakeaways: string[];
    relatedIds: string[];
}

type CollectionId = "all" | "calm-now" | "understand" | "live-well";

interface Collection {
    id: CollectionId;
    label: string;
    short: string;
    icon: React.ElementType;
    description: string;
}

// ─── Collections ──────────────────────────────────────────────────────────────
// Three calm collections instead of 8 noisy categories. Each existing item is
// still classified by its `category` and `type`, then mapped into a collection
// via `deriveCollection` below.

const collections: Collection[] = [
    {
        id: "all",
        label: "All resources",
        short: "All",
        icon: Sparkles,
        description: "Everything in the library",
    },
    {
        id: "calm-now",
        label: "Calm yourself now",
        short: "Calm now",
        icon: Flower2,
        description: "Quick exercises, breathing, and grounding for hard moments.",
    },
    {
        id: "understand",
        label: "Understand your mind",
        short: "Understand",
        icon: Brain,
        description: "Plain-language reads on anxiety, self-talk, and CBT tools.",
    },
    {
        id: "live-well",
        label: "Live well day to day",
        short: "Day to day",
        icon: Activity,
        description: "Sleep, study, and relationships — gentle habits that stick.",
    },
];

function deriveCollection(item: ContentItem): Exclude<CollectionId, "all"> {
    if (item.category === "study-skills" || item.category === "relationships") return "live-well";
    if (
        item.type === "exercise" ||
        item.type === "audio" ||
        item.category === "mindfulness" ||
        item.category === "stress-management"
    )
        return "calm-now";
    return "understand";
}

function categoryLabel(categoryId: string): string {
    const map: Record<string, string> = {
        "stress-management": "Stress",
        anxiety: "Anxiety",
        "self-esteem": "Self-esteem",
        "study-skills": "Study & focus",
        relationships: "Relationships",
        mindfulness: "Mindfulness",
        "cbt-techniques": "CBT",
    };
    return map[categoryId] ?? categoryId.replace(/-/g, " ");
}

const typeFilters: { id: ContentType | "all"; label: string; icon: React.ElementType }[] = [
    { id: "all", label: "All", icon: Sparkles },
    { id: "article", label: "Articles", icon: FileText },
    { id: "video", label: "Videos", icon: Play },
    { id: "audio", label: "Audio", icon: Headphones },
    { id: "exercise", label: "Exercises", icon: CheckCircle2 },
];

// ─── Content Data ─────────────────────────────────────────────────────────────

const allContent: ContentItem[] = [
    {
        id: "1",
        title: "The 5-4-3-2-1 Grounding Technique",
        description: "A simple sensory exercise to pull yourself out of anxiety spirals in under 3 minutes.",
        longDescription: "When anxiety hits — that tight feeling in your chest, the racing thoughts, the sense of losing control — your body is in fight-or-flight mode. The 5-4-3-2-1 grounding technique works by redirecting your brain from the anxious thought loop back to the present moment through your five senses.\n\nHere's how it works:\n• 5 things you can SEE — Look around and name them. The ceiling fan, your notebook, a crack in the wall.\n• 4 things you can TOUCH — Feel the texture of your desk, your clothes, a pen.\n• 3 things you can HEAR — The fan humming, traffic outside, your own breathing.\n• 2 things you can SMELL — Your hand sanitizer, the air freshener.\n• 1 thing you can TASTE — The residual taste in your mouth, or take a sip of water.\n\nThis technique is rooted in Cognitive Behavioral Therapy (CBT) and has been shown in research studies to reduce acute anxiety symptoms in 2-5 minutes. Indian students report this is especially helpful before exams, presentations, and viva voce.",
        type: "exercise",
        category: "anxiety",
        tags: ["grounding", "quick-relief", "CBT", "exam-anxiety"],
        duration: "3 min",
        difficulty: "beginner",
        author: "Dr. Priya Sharma",
        authorCredential: "Clinical Psychologist, NIMHANS",
        rating: 4.9,
        readCount: 12400,
        imageEmoji: "🌊",
        featured: true,
        keyTakeaways: [
            "Uses your 5 senses to redirect attention from anxious thoughts",
            "Can be done anywhere — during an exam, in a bus, before a presentation",
            "Research-backed CBT technique effective in 2-5 minutes",
            "Regular practice makes it more effective over time",
        ],
        relatedIds: ["3", "8"],
    },
    {
        id: "2",
        title: "Why Indian Students Struggle with Saying 'No'",
        description: "Understanding the cultural roots of people-pleasing and how to set boundaries respectfully.",
        longDescription: "In Indian culture, saying 'no' — especially to elders, teachers, or authority figures — is often associated with disrespect. We grow up hearing 'adjust karo', 'zyada mat bol', and learning to suppress our own needs.\n\nBut research shows that an inability to set boundaries is directly linked to burnout, resentment, anxiety, and even depression. This doesn't mean our culture is wrong — it means we need to find culturally-sensitive ways to honor our needs while respecting our relationships.\n\nHealthy boundary-setting strategies for Indian students:\n\n1. **The Sandwich Method** — Start with appreciation, state your boundary, end with care. 'Papa, I know you want me to attend the function, but I have exams next week and I need to study. I'll video call everyone after my paper.'\n\n2. **The Delayed Response** — 'Let me think about it and get back to you.' This gives you time to decide without the guilt of an immediate refusal.\n\n3. **The Honest Voice** — Start with feelings: 'I feel overwhelmed when...' instead of 'You always...'\n\n4. **Recognizing Guilt vs. Values** — Guilt after setting a boundary doesn't mean you did something wrong. It means you did something new.\n\nRemember: A boundary is not a wall. It's a gate that YOU control.",
        type: "article",
        category: "self-esteem",
        tags: ["boundaries", "cultural-context", "people-pleasing", "assertiveness"],
        duration: "7 min read",
        difficulty: "intermediate",
        author: "Dr. Anjali Mehta",
        authorCredential: "Counseling Psychologist, Tata Institute",
        rating: 4.8,
        readCount: 8900,
        imageEmoji: "🛡️",
        featured: true,
        keyTakeaways: [
            "Cultural conditioning makes saying 'no' feel like disrespect",
            "Inability to set boundaries leads to burnout and resentment",
            "The Sandwich Method helps say no while maintaining respect",
            "Guilt after a healthy boundary is normal — it means growth",
        ],
        relatedIds: ["5", "10"],
    },
    {
        id: "3",
        title: "Box Breathing: The Navy SEAL Technique",
        description: "A powerful regulated breathing pattern used by soldiers and surgeons to stay calm under pressure.",
        longDescription: "Box breathing (also called 4-4-4-4 breathing) is a technique used by Navy SEALs, surgeons, and elite athletes to manage extreme stress. It works by activating your parasympathetic nervous system — your body's 'rest and digest' mode.\n\nThe steps are simple:\n1. Breathe IN for 4 seconds\n2. HOLD for 4 seconds\n3. Breathe OUT for 4 seconds\n4. HOLD for 4 seconds\n5. Repeat for 4-5 cycles\n\nWhy it works: When you're anxious, your breathing becomes shallow and fast, which signals your brain that you're in danger. By deliberately slowing your breath to a fixed pattern, you send the opposite signal — 'I am safe.'\n\nStudies from IIT Bombay's wellness center found that engineering students who practiced box breathing for 5 minutes before exams scored an average of 12% higher on anxiety-heavy subjects like mathematics.\n\nPro tip: Practice this when you're calm so your body remembers the pattern when you need it during stress.",
        type: "exercise",
        category: "stress-management",
        tags: ["breathing", "quick-relief", "exam-prep", "focus"],
        duration: "5 min",
        difficulty: "beginner",
        author: "Dr. Vikram Patel",
        authorCredential: "Psychiatrist, WHO Consultant",
        rating: 4.7,
        readCount: 15600,
        imageEmoji: "🫁",
        featured: false,
        keyTakeaways: [
            "Breathe in 4s → Hold 4s → Out 4s → Hold 4s → Repeat",
            "Activates your parasympathetic nervous system",
            "Shown to improve exam performance by reducing cognitive anxiety",
            "Practice when calm so your body remembers during stress",
        ],
        relatedIds: ["1", "8"],
    },
    {
        id: "4",
        title: "The Pomodoro Technique — Indian Student Edition",
        description: "Adapt the famous focus technique to work with Indian study schedules and family interruptions.",
        longDescription: "The Pomodoro Technique was invented by Francesco Cirillo in the 1980s. But the original format — 25-minute focus blocks — doesn't always work for Indian students who deal with joint families, unexpected chai breaks, and parents who believe 'rest' means watching TV together.\n\nHere's an adapted version:\n\n**The Desi Pomodoro Method:**\n\n🍅 **Focus Block**: 25-35 minutes of deep study (adjust based on subject)\n☕ **Short Break**: 5-7 minutes — stretch, drink water, quick chat with family\n🍅🍅🍅 **After 3 blocks**: Take a 15-20 minute long break\n\n**Dealing with interruptions:**\n- Tell family your schedule in advance: 'Mummy, I'll come for chai at 4:30'\n- Put phone in another room (not just silent — ANOTHER ROOM)\n- Use the first block for your hardest subject when willpower is highest\n\n**Subject-specific tips:**\n- Math/Physics: 30-min blocks with pen-and-paper problem solving\n- Theory subjects: 25-min blocks with active recall testing\n- Revision: 20-min rapid review blocks\n\nResearch from IIT Delhi shows students who used structured study blocks retained 40% more information compared to marathon study sessions.",
        type: "article",
        category: "study-skills",
        tags: ["study-technique", "focus", "time-management", "productivity"],
        duration: "6 min read",
        difficulty: "beginner",
        author: "Prof. Raghav Menon",
        authorCredential: "Educational Psychologist, IIT Delhi",
        rating: 4.6,
        readCount: 21300,
        imageEmoji: "🍅",
        featured: true,
        keyTakeaways: [
            "Adapted for Indian households — family interruptions factored in",
            "Adjust block lengths per subject type",
            "Phone in another room, not just on silent",
            "Structured blocks improve retention by 40% vs. marathon sessions",
        ],
        relatedIds: ["7", "11"],
    },
    {
        id: "5",
        title: "Understanding Impostor Syndrome in College",
        description: "Why high-achieving Indian students often feel like frauds — and how to silence that inner critic.",
        longDescription: "You cracked a tough entrance exam, got into a good college, and now... you feel like you don't belong. Like everyone around you is smarter. Like any day now, people will figure out you're not actually that smart.\n\nThis is impostor syndrome, and it affects up to 70% of people at some point — especially high-achievers in competitive environments like IITs, AIIMS, and NLUs.\n\n**Why it hits Indian students harder:**\n- Extreme competition creates a 'survivor guilt' — 'I got in but 10 lakh students didn't'\n- Comparison culture: 'Sharma ji ka beta scored more'\n- Family expectations create pressure to always perform\n- First-generation college students feel additional cultural imposter feelings\n\n**How to fight it:**\n\n1. **The Evidence Journal** — Write down 3 real accomplishments each week. Not 'I'm smart' but 'I solved that differential equations set without help.'\n\n2. **Talk about it** — Studies show that simply naming impostor syndrome reduces its power. 'Hey, I'm feeling like a fraud today.'\n\n3. **Reframe failure** — 'I didn't fail, I discovered one more method that doesn't work.'\n\n4. **The Dunning-Kruger flip** — If you feel like you don't know enough, you probably know more than you think. It's the people who know nothing who feel most confident.\n\n5. **Find your people** — Connect with students who validate your experience rather than dismiss it.",
        type: "article",
        category: "self-esteem",
        tags: ["impostor-syndrome", "college", "self-doubt", "competition"],
        duration: "8 min read",
        difficulty: "intermediate",
        author: "Dr. Swati Joshi",
        authorCredential: "Counselor, JNU Student Wellness",
        rating: 4.9,
        readCount: 9700,
        imageEmoji: "🎭",
        featured: false,
        keyTakeaways: [
            "70% of high-achievers experience impostor syndrome",
            "Indian competitive culture amplifies these feelings",
            "Keep an 'Evidence Journal' of real accomplishments",
            "Simply naming the feeling reduces its power",
        ],
        relatedIds: ["2", "10"],
    },
    {
        id: "6",
        title: "Body Scan Meditation for Beginners",
        description: "A 10-minute guided meditation to release tension stored in your body.",
        longDescription: "Your body keeps score of your stress. Tight shoulders from hunching over textbooks. Clenched jaw from suppressing frustration. Knots in your stomach before every exam. A body scan meditation helps you notice — and release — this stored tension.\n\n**How to practice:**\n\nFind a comfortable position (lying down or sitting). Close your eyes.\n\n1. Start at the top of your head. Notice any sensation — tingling, warmth, tightness.\n2. Slowly move your attention down: forehead → eyes → jaw → neck → shoulders.\n3. At each spot, breathe INTO that area and imagine the tension melting away.\n4. Continue through: arms → hands → chest → stomach → hips → legs → feet.\n5. Finish by noticing your whole body at once.\n\n**Common experiences:**\n- You might feel sleepy — that's your body finally relaxing\n- Some areas might feel 'numb' — that's normal, it means you've been disconnected from that body part\n- You might notice emotions — tension in the chest often holds anxiety; tight throat can indicate suppressed words\n\nStudies from AIIMS Delhi show that medical students who practiced body scan meditation for 10 minutes daily reported 35% less physical stress symptoms after 4 weeks.",
        type: "audio",
        category: "mindfulness",
        tags: ["meditation", "body-scan", "relaxation", "stress-relief"],
        duration: "10 min",
        difficulty: "beginner",
        author: "Dr. Kabir Das",
        authorCredential: "Mindfulness Researcher, AIIMS",
        rating: 4.8,
        readCount: 7200,
        imageEmoji: "🧘",
        featured: false,
        keyTakeaways: [
            "Systematically scan your body from head to toe",
            "Breathe into areas of tension and imagine it melting",
            "10 minutes daily reduces physical stress by 35%",
            "Emotions are often stored as physical sensations",
        ],
        relatedIds: ["3", "8"],
    },
    {
        id: "7",
        title: "How Social Media Affects Your Brain",
        description: "The neuroscience behind doom scrolling, comparison traps, and digital anxiety.",
        longDescription: "Every time you get a like on Instagram, your brain releases dopamine — the same chemical released by eating chocolate or receiving a compliment. The problem? Social media has engineered this response to be unpredictable (variable ratio reinforcement), which is the exact mechanism that makes gambling addictive.\n\n**The Indian student context:**\n- Average Indian student spends 3.5 hours daily on social media\n- FOMO is amplified by seeing peers' highlight reels — trips, relationships, achievements\n- 'Comparison is the thief of joy' becomes real when you see 500 stories daily\n- Short-form content (Reels, Shorts) reduces attention span and depth of thinking\n\n**What the research shows:**\n- 30+ minutes of social media daily is associated with increased anxiety and depression in young adults (Twenge, 2019)\n- Students who didn't use social media for 1 week reported significantly lower loneliness and depression (University of Bath, 2022)\n\n**Practical strategies:**\n\n1. **The 20-minute rule** — Set a timer before opening any social app\n2. **Mute, don't unfollow** — Reduce triggering content without social consequences\n3. **Morning phone-free window** — Don't touch your phone for the first 30 minutes after waking\n4. **Content diet** — Unfollow accounts that make you feel bad; follow ones that educate\n5. **Use 'time spent' tracking** — Both Android and iOS have built-in screen time tools",
        type: "video",
        category: "anxiety",
        tags: ["social-media", "digital-wellness", "dopamine", "attention"],
        duration: "12 min watch",
        difficulty: "beginner",
        author: "Dr. Rohan Kapoor",
        authorCredential: "Neuroscientist, IISc Bangalore",
        rating: 4.7,
        readCount: 18900,
        imageEmoji: "📱",
        featured: true,
        keyTakeaways: [
            "Social media uses the same addictive mechanisms as gambling",
            "Indian students average 3.5 hours daily on social media",
            "1 week without social media significantly reduces depression",
            "30-minute daily limit is the evidence-based recommendation",
        ],
        relatedIds: ["4", "11"],
    },
    {
        id: "8",
        title: "Progressive Muscle Relaxation Guide",
        description: "Tense and release muscle groups to reduce physical anxiety — perfect for late-night study sessions.",
        longDescription: "Progressive Muscle Relaxation (PMR) is a technique developed by Dr. Edmund Jacobson in the 1930s. The principle is simple: you can't be physically tense and mentally relaxed at the same time. By deliberately tensing and then releasing each muscle group, you teach your body what relaxation actually feels like.\n\n**The routine (15 minutes):**\n\nFor each muscle group, TENSE for 5 seconds, then RELEASE for 15 seconds.\n\n1. **Hands** — Make tight fists → Release\n2. **Forearms** — Bend wrists back → Release\n3. **Biceps** — Flex your arms like showing muscles → Release\n4. **Shoulders** — Shrug up to your ears → Release\n5. **Forehead** — Raise eyebrows high → Release\n6. **Eyes** — Squeeze eyes shut → Release\n7. **Jaw** — Clench teeth gently → Release\n8. **Neck** — Press head back against pillow/chair → Release\n9. **Chest** — Take a deep breath, hold → Release\n10. **Stomach** — Tighten abs → Release\n11. **Thighs** — Press legs together → Release\n12. **Calves** — Point toes up → Release\n13. **Feet** — Curl toes → Release\n\n**Why this is great for students:**\n- Can be done at your study desk\n- Especially effective for insomnia — do it in bed before sleep\n- Takes only 15 minutes but the relaxation lasts for hours\n- Helps with tension headaches from long study sessions",
        type: "exercise",
        category: "stress-management",
        tags: ["relaxation", "PMR", "physical-anxiety", "sleep"],
        duration: "15 min",
        difficulty: "beginner",
        author: "Dr. Meera Singh",
        authorCredential: "Sports Psychologist, SAI",
        rating: 4.6,
        readCount: 6800,
        imageEmoji: "💆",
        featured: false,
        keyTakeaways: [
            "Tense each muscle group for 5s then release for 15s",
            "Works because you can't be physically tense and mentally relaxed simultaneously",
            "Especially effective for insomnia and tension headaches",
            "Can be done at your study desk in 15 minutes",
        ],
        relatedIds: ["1", "3"],
    },
    {
        id: "9",
        title: "Cognitive Distortions: The Lies Your Brain Tells You",
        description: "Learn to identify 10 common thinking traps that fuel anxiety and depression.",
        longDescription: "Your brain is not always your friend. In fact, it regularly lies to you through patterns called 'cognitive distortions' — automatic, convincing, but ultimately inaccurate ways of thinking that make you feel worse.\n\nIdentified by psychiatrist Aaron Beck and popularized by David Burns in 'Feeling Good', these patterns are at the heart of Cognitive Behavioral Therapy (CBT).\n\n**10 Cognitive Distortions Common in Indian Students:**\n\n1. **All-or-Nothing Thinking** — 'If I don't get 90%, I'm a failure' (No middle ground)\n\n2. **Catastrophizing** — 'I failed one test, my career is over' (Worst-case thinking)\n\n3. **Mind Reading** — 'Everyone in class thinks I'm stupid' (Assuming without evidence)\n\n4. **Should Statements** — 'I should be able to study 12 hours daily' (Unrealistic demands)\n\n5. **Personalization** — 'Sir was in a bad mood because of my answer' (It's not about you)\n\n6. **Emotional Reasoning** — 'I feel like a failure, therefore I am one' (Feelings ≠ facts)\n\n7. **Filtering** — Getting 95% but fixating on the 5% you lost\n\n8. **Overgeneralization** — 'I always mess up' (One event becomes a pattern)\n\n9. **Labeling** — 'I'm such an idiot' instead of 'I made a mistake'\n\n10. **Fortune Telling** — 'I know I'll blank out during the viva'\n\n**How to challenge them:**\nFor each thought, ask:\n- What is the evidence FOR this thought?\n- What is the evidence AGAINST it?\n- What would I tell my best friend if they had this thought?\n- Am I confusing a feeling with a fact?",
        type: "article",
        category: "cbt-techniques",
        tags: ["CBT", "cognitive-distortions", "thinking-traps", "depression"],
        duration: "10 min read",
        difficulty: "intermediate",
        author: "Dr. Nandita Roy",
        authorCredential: "CBT Specialist, TISS Mumbai",
        rating: 4.9,
        readCount: 14200,
        imageEmoji: "🧠",
        featured: true,
        keyTakeaways: [
            "10 common thinking traps that worsen anxiety and depression",
            "All-or-nothing thinking is the most common distortion in students",
            "Challenge thoughts by separating feelings from facts",
            "Ask: What would I tell my best friend with this thought?",
        ],
        relatedIds: ["5", "12"],
    },
    {
        id: "10",
        title: "How to Talk to Your Parents About Mental Health",
        description: "A practical script for Indian students to approach the 'log kya kahenge' generation.",
        longDescription: "Indian parents aren't emotionally unavailable — most of them simply grew up in a generation where mental health wasn't discussed. When you say 'I'm depressed', they might hear 'I've failed as a parent.' Understanding this reframe is key to a productive conversation.\n\n**Before the conversation:**\n- Choose a calm moment (not during an argument)\n- Practice what you want to say\n- Prepare for their questions and fears\n\n**A sample script:**\n\n'Mummy/Papa, I want to talk about something important. I've been struggling with [anxiety/low mood/stress], and I want you to know it's not because of anything you've done. I love our family. But I've learned that just like we go to a doctor for a fever, sometimes our mind needs a doctor too. I'd like to speak to a counselor. It doesn't mean I'm weak — it means I'm being smart about my health.'\n\n**Common parent responses and how to handle them:**\n\n💬 'Log kya kahenge?' → 'Nobody needs to know. Counseling is completely private.'\n💬 'You're just making excuses' → 'I understand it might seem that way. But my studies are actually suffering because of this.'\n💬 'We never needed all this' → 'I respect that. Different generations face different challenges. I want to handle mine well.'\n💬 'Are you talking about suicide?' → Be honest. If yes, this is when you need immediate professional help.\n\n**Resources to share with parents:**\n- NIMHANS parent helpline: 080-46110007\n- Vandrevala Foundation: 9999666555\n- iCall parenting support: 9152987821",
        type: "article",
        category: "relationships",
        tags: ["family", "communication", "cultural-context", "seeking-help"],
        duration: "8 min read",
        difficulty: "intermediate",
        author: "Dr. Aparna Iyer",
        authorCredential: "Family Therapist, Fortis Healthcare",
        rating: 4.9,
        readCount: 22100,
        imageEmoji: "💬",
        featured: true,
        keyTakeaways: [
            "Parents may hear 'I've failed' when you say 'I'm depressed'",
            "Choose a calm moment and use the sample script provided",
            "Address 'log kya kahenge' with privacy reassurance",
            "Share professional helpline numbers with parents",
        ],
        relatedIds: ["2", "5"],
    },
    {
        id: "11",
        title: "Sleep Hygiene for Night-Owl Students",
        description: "Why your 3 AM study sessions are destroying your memory — and what to do instead.",
        longDescription: "Here's the neuroscience truth that no coaching institute tells you: sleep is when your brain converts short-term memories into long-term ones. When you sacrifice sleep to study, you're literally erasing what you studied.\n\n**The science:**\n- During deep sleep (NREM Stage 3), your brain replays and consolidates the day's learning\n- REM sleep (dreaming) connects new knowledge with existing knowledge\n- Every hour of sleep lost below 7 hours reduces next-day cognitive function by approximately 10%\n\n**Sleep hygiene tips for Indian students:**\n\n1. **Fixed wake-up time** — More important than bedtime. Same time every day, including weekends.\n2. **No screens 30 min before bed** — Blue light suppresses melatonin. Read a physical book instead.\n3. **Room temperature** — Indian rooms are often too hot. Use a fan even in winter for air circulation.\n4. **Caffeine deadline** — No chai or coffee after 2 PM. Yes, that includes your evening chai. Sorry.\n5. **The 'worry dump'** — Write tomorrow's to-do list before bed so your brain stops planning.\n6. **Strategic napping** — 20-minute power nap between 1-3 PM is fine. Longer = groggy.\n\n**The optimal study-sleep schedule:**\n- Study 6 AM - 10 PM with breaks (Pomodoro style)\n- Wind down 10 - 10:30 PM\n- Sleep 10:30 PM - 5:30/6 AM (7-7.5 hours)\n\nStudents who follow this schedule consistently outperform night owls by 15-20% in recall tests.",
        type: "article",
        category: "study-skills",
        tags: ["sleep", "memory", "study-schedule", "neuroscience"],
        duration: "7 min read",
        difficulty: "beginner",
        author: "Dr. Sanjay Gupta",
        authorCredential: "Sleep Researcher, AIIMS",
        rating: 4.7,
        readCount: 16500,
        imageEmoji: "🌙",
        featured: false,
        keyTakeaways: [
            "Sleep converts short-term memories into long-term ones",
            "Every hour below 7 hours reduces cognition by ~10%",
            "No caffeine after 2 PM — including evening chai",
            "Fixed wake-up time is more important than fixed bedtime",
        ],
        relatedIds: ["4", "7"],
    },
    {
        id: "12",
        title: "The ABC Model: Challenging Negative Thoughts",
        description: "Use this CBT framework to break the cycle between events, beliefs, and emotional consequences.",
        longDescription: "Albert Ellis developed the ABC model — one of the most practical tools in psychology. It shows that events don't directly cause your feelings. Your BELIEFS about the event create your emotional response.\n\n**A** = Activating Event (what happened)\n**B** = Belief (what you think about it)\n**C** = Consequence (how you feel and behave)\n\n**Example:**\nA: Your friend didn't reply to your message for 2 days\nB: 'They don't care about me. Nobody really likes me.'\nC: You feel sad, withdrawn, and stop reaching out to friends.\n\n**The fix — Add D and E:**\n**D** = Dispute the belief: 'Is there evidence? Could they be busy? Am I mind-reading?'\n**E** = Effective new belief: 'They might be busy. I'll check in once more without assuming the worst.'\n\n**Indian context examples:**\n\n📚 A: Got 78% in maths\nB: 'I'm going to fail JEE. My life is over.'\nD: 'One score doesn't predict my entire future. I can analyze my mistakes and improve.'\nE: 'I'll focus on weak topics and retake the mock.'\n\n👨‍👩‍👧 A: Parents compared you to cousin\nB: 'I'm not good enough. I'll never make them proud.'\nD: 'My parents express care through comparison — it's their love language. My worth isn't defined by comparison.'\nE: 'I'll have a calm conversation about how this makes me feel.'\n\nPractice this with 1 negative thought per day. Within 2 weeks, you'll notice the automatic thoughts becoming less powerful.",
        type: "exercise",
        category: "cbt-techniques",
        tags: ["CBT", "ABC-model", "negative-thoughts", "reframing"],
        duration: "8 min",
        difficulty: "intermediate",
        author: "Dr. Nandita Roy",
        authorCredential: "CBT Specialist, TISS Mumbai",
        rating: 4.8,
        readCount: 11300,
        imageEmoji: "🔄",
        featured: false,
        keyTakeaways: [
            "Events don't cause feelings — your BELIEFS about events do",
            "A (Event) → B (Belief) → C (Consequence) → D (Dispute) → E (New Belief)",
            "Practice with 1 negative thought daily for 2 weeks",
            "Especially helpful for comparison-triggered distress",
        ],
        relatedIds: ["9", "5"],
    },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCount(n: number): string {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toString();
}

const typeIconMap: Record<ContentType, React.ElementType> = {
    article: FileText,
    video: Play,
    audio: Headphones,
    exercise: CheckCircle2,
};

const SAVED_KEY = "mm-psych-resources-saved";

const sectionEyebrow = "text-[11px] font-medium uppercase tracking-[0.2em] text-ink-5";

type LongReadGuide = {
    path: string;
    kicker: string;
    title: string;
    description: string;
    readLabel: string;
    emoji: string;
};

const longReadGuides: LongReadGuide[] = [
    {
        path: "/articles/grounding-rituals-busy-mornings",
        kicker: "Morning",
        title: "3 grounding rituals for busy mornings",
        description: "Tiny rituals to feel calmer and more present before the day pulls you in.",
        readLabel: "4 min read",
        emoji: "🌅",
    },
    {
        path: "/articles/reset-your-nervous-system",
        kicker: "Regulation",
        title: "How to reset your nervous system in 2 minutes",
        description: "When you feel flooded or overstimulated, a short sequence can help you feel safer.",
        readLabel: "3 min read",
        emoji: "🌿",
    },
    {
        path: "/articles/calming-bedtime-routine",
        kicker: "Rest",
        title: "A calming bedtime routine for deep rest",
        description: "Help your body slow down so sleep feels more inviting.",
        readLabel: "4 min read",
        emoji: "🌙",
    },
    {
        path: "/articles/mountain-reset-calmer-mind",
        kicker: "Visual",
        title: "Mountain reset for a calmer mind",
        description: "A mountain-based visual reset when thoughts feel loud.",
        readLabel: "4 min read",
        emoji: "⛰️",
    },
    {
        path: "/articles/nature-focus-visual-grounding",
        kicker: "Practice",
        title: "Nature focus: 5-minute visual grounding",
        description: "Reconnect with the present through gentle observation.",
        readLabel: "5 min practice",
        emoji: "🍃",
    },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const ContentTypeChip = ({ type }: { type: ContentType }) => {
    const Icon = typeIconMap[type];
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                "border border-ink-3/25 bg-[hsl(var(--ink-1))]/60 text-ink-7 dark:border-ink-3/20 dark:text-ink-6",
            )}
        >
            <Icon className="h-3 w-3 text-[hsl(var(--accent-600))] dark:text-[hsl(var(--accent-400))]" />
            <span className="capitalize">{type}</span>
        </span>
    );
};

const RatingStars = ({ rating }: { rating: number }) => {
    const full = Math.floor(rating);
    return (
        <span className="inline-flex items-center gap-0.5 text-amber-500">
            {Array.from({ length: full }).map((_, i) => (
                <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            ))}
            <span className="ml-1 text-xs font-medium text-ink-5">{rating}</span>
        </span>
    );
};

function categoryLabelFor(categoryId: string): string {
    return categoryLabel(categoryId);
}

function formatContentTypeLabel(type: ContentType): string {
    if (type === "article") return "Article";
    if (type === "video") return "Video";
    if (type === "audio") return "Audio";
    return "Exercise";
}

const ContentCard = ({
    item,
    onOpen,
    bookmarked,
    onToggleBookmark,
}: {
    item: ContentItem;
    onOpen: (item: ContentItem) => void;
    bookmarked: boolean;
    onToggleBookmark: (id: string, e: React.MouseEvent) => void;
}) => {
    const topic = categoryLabelFor(item.category);
    const typeLabel = formatContentTypeLabel(item.type);
    const tags = item.tags.slice(0, 2);
    const extraTags = item.tags.length - tags.length;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: duration.base, ease: ease.outExpo }}
            whileHover={{ y: -3 }}
            className="h-full"
        >
            <Card
                className={cn(
                    "group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-[1.35rem] border bg-[hsl(var(--card))] shadow-dashboard-soft",
                    "border-ink-3/30 transition-[border-color,box-shadow,transform] duration-300 ease-out",
                    "hover:border-[hsl(var(--accent-400))]/35 hover:shadow-lg dark:border-ink-3/25",
                    "border-l-[3px] border-l-[hsl(var(--accent-500))] pl-[1px] dark:border-l-[hsl(var(--accent-400))]",
                )}
                onClick={() => onOpen(item)}
            >
                <div className="flex flex-1 flex-col px-6 pb-2 pt-6">
                    <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 pt-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-ink-5 sm:text-[11px] sm:tracking-[0.12em]">
                            <span className="text-ink-6">{topic}</span>
                            <span className="mx-1.5 text-ink-4">·</span>
                            <span>{typeLabel}</span>
                            <span className="mx-1.5 text-ink-4">·</span>
                            <span className="capitalize">{item.difficulty}</span>
                        </p>
                        <span
                            className="flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-lg bg-[hsl(var(--ink-1))]/80 text-lg leading-none shadow-sm ring-1 ring-ink-3/10 transition-transform duration-300 ease-out group-hover:scale-110 group-hover:bg-[hsl(var(--accent-50))] dark:bg-[hsl(var(--ink-2))]/80 dark:group-hover:bg-[hsl(var(--accent-900))]"
                            aria-hidden
                        >
                            {item.imageEmoji}
                        </span>
                    </div>

                    <h3 className="mt-4 min-h-[3rem] line-clamp-2 text-balance font-display text-[1.05rem] font-medium leading-snug tracking-tight text-ink-8 transition-colors group-hover:text-[hsl(var(--accent-600))] dark:group-hover:text-[hsl(var(--accent-400))]">
                        {item.title}
                    </h3>

                    <p className="mt-2 min-h-[2.75rem] line-clamp-2 text-[13.5px] leading-relaxed text-ink-6 transition-colors group-hover:text-ink-7">{item.description}</p>

                    {tags.length > 0 ? (
                        <div className="mt-auto pt-4 flex min-h-[1.75rem] flex-wrap items-center gap-2">
                            {tags.map((tag, idx) => (
                                <span
                                    key={`${item.id}-${tag}-${idx}`}
                                    className="rounded-md bg-[hsl(var(--ink-1))]/80 px-2 py-1 text-[10px] uppercase font-bold tracking-wide text-ink-6 transition-colors group-hover:bg-[hsl(var(--ink-2))] dark:bg-[hsl(var(--ink-2))]/50"
                                >
                                    {tag.replace(/-/g, " ")}
                                </span>
                            ))}
                            {extraTags > 0 ? (
                                <span className="text-[11px] font-medium text-ink-5 transition-colors group-hover:text-[hsl(var(--accent-600))] dark:group-hover:text-[hsl(var(--accent-400))]">+{extraTags}</span>
                            ) : null}
                        </div>
                    ) : (
                        <div className="mt-auto pt-4 min-h-[1.75rem]" />
                    )}
                </div>

                <div className="flex min-h-[3.25rem] items-center justify-between gap-3 border-t border-ink-3/15 px-6 py-3.5 bg-[hsl(var(--ink-1))]/10 transition-colors group-hover:bg-[hsl(var(--ink-1))]/30 dark:border-ink-3/20">
                    <p className="min-w-0 truncate text-[12px] tabular-nums text-ink-5">
                        <span className="inline-flex items-center gap-0.5 text-amber-600/90 dark:text-amber-400/90">
                            <Star className="h-3 w-3 fill-amber-400/80 text-amber-500" aria-hidden />
                            {item.rating.toFixed(1)}
                        </span>
                        <span className="mx-1.5 text-ink-4">·</span>
                        <span>{formatCount(item.readCount)} reads</span>
                        <span className="mx-1.5 text-ink-4">·</span>
                        <span>{item.duration}</span>
                    </p>
                    <button
                        type="button"
                        onClick={(e) => onToggleBookmark(item.id, e)}
                        className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-transparent transition-colors",
                            "hover:border-ink-3/25 hover:bg-[hsl(var(--ink-1))]/50",
                            bookmarked ? "text-[hsl(var(--accent-600))] dark:text-[hsl(var(--accent-400))]" : "text-ink-5",
                        )}
                        aria-label={bookmarked ? "Remove from saved" : "Save for later"}
                    >
                        {bookmarked ? <BookmarkCheck className="h-[1.125rem] w-[1.125rem]" /> : <Bookmark className="h-[1.125rem] w-[1.125rem]" />}
                    </button>
                </div>
            </Card>
        </motion.div>
    );
};

const FeaturedHeroCard = ({ item, onOpen }: { item: ContentItem; onOpen: (item: ContentItem) => void }) => (
    <motion.button
        type="button"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: duration.long, ease: ease.outExpo }}
        onClick={() => onOpen(item)}
        className={cn(
            "group w-full text-left",
            "rounded-[1.75rem] border border-[hsl(var(--accent-400))]/25 bg-[hsl(var(--card))]/90 p-6 shadow-dashboard-soft backdrop-blur-sm",
            "transition-shadow hover:shadow-lg md:p-8 dark:border-[hsl(var(--accent-500))]/20",
        )}
    >
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
            <div className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--accent-100))]/60 text-[2.75rem] dark:bg-[hsl(var(--accent-100))]/20">
                {item.imageEmoji}
            </div>
            <div className="min-w-0 flex-1">
                <p className={sectionEyebrow}>Start here</p>
                <h2 className="mt-2 font-display text-2xl font-light tracking-tight text-ink-8 sm:text-3xl">{item.title}</h2>
                <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-6">{item.description}</p>
                <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-ink-5">
                    <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        {item.duration}
                    </span>
                    <RatingStars rating={item.rating} />
                    <span>{formatCount(item.readCount)} reads</span>
                </div>
            </div>
            <div className="flex shrink-0 justify-end md:items-center">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[hsl(var(--accent-500))] text-white shadow-md transition-transform group-hover:translate-x-0.5">
                    <ArrowRight className="h-5 w-5" strokeWidth={1.8} />
                </span>
            </div>
        </div>
    </motion.button>
);

function ResourceReaderDialog({
    item,
    open,
    onClose,
}: {
    item: ContentItem | null;
    open: boolean;
    onClose: () => void;
}) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [progress, setProgress] = useState(0);
    const [takeawayIndex, setTakeawayIndex] = useState(0);

    const handleScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        const max = el.scrollHeight - el.clientHeight;
        setProgress(max <= 0 ? 1 : Math.min(1, el.scrollTop / max));
    }, []);

    useEffect(() => {
        if (!open) {
            setProgress(0);
            setTakeawayIndex(0);
            return;
        }
        const el = scrollRef.current;
        if (el) {
            el.scrollTop = 0;
            handleScroll();
        }
    }, [open, item, handleScroll]);

    if (!item) return null;

    const takeaways = item.keyTakeaways;
    const nextInsight = () => setTakeawayIndex((i) => (i + 1) % takeaways.length);

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-h-[min(90vh,760px)] max-w-2xl gap-0 overflow-hidden rounded-[1.5rem] border border-ink-3/30 p-0 shadow-dashboard-soft dark:border-ink-3/25">
                <div className="h-1 w-full bg-[hsl(var(--ink-2))] dark:bg-[hsl(var(--ink-3))]/40">
                    <div
                        className="h-full bg-[hsl(var(--accent-500))] transition-[width] duration-150 ease-out"
                        style={{ width: `${Math.round(progress * 100)}%` }}
                    />
                </div>
                <DialogHeader className="space-y-0 border-b border-ink-3/20 px-5 pb-4 pt-5 text-left sm:px-6">
                    <div className="flex items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--accent-100))]/50 text-2xl dark:bg-[hsl(var(--accent-100))]/20">
                            {item.imageEmoji}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <ContentTypeChip type={item.type} />
                                <span className="inline-flex items-center gap-1 text-xs text-ink-5">
                                    <Clock className="h-3 w-3" />
                                    {item.duration}
                                </span>
                            </div>
                            <DialogTitle className="mt-2 font-display text-xl font-normal leading-snug tracking-tight text-ink-8 sm:text-2xl">
                                {item.title}
                            </DialogTitle>
                            <p className="mt-1.5 text-sm text-ink-6">
                                <span className="font-medium text-ink-8">{item.author}</span>
                                <span className="text-ink-5"> — {item.authorCredential}</span>
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    className="max-h-[min(52vh,420px)] overflow-y-auto px-5 py-5 sm:px-6"
                >
                    <div className="space-y-4 text-[15px] leading-[1.75] text-ink-6">
                        {item.longDescription.split("\n\n").map((paragraph, idx) => (
                            <p key={idx} className="whitespace-pre-line last:mb-0">
                                {paragraph}
                            </p>
                        ))}
                    </div>
                </div>

                {takeaways.length > 0 ? (
                    <div className="border-t border-ink-3/20 bg-[hsl(var(--warmth-50))]/40 px-5 py-4 dark:bg-[hsl(var(--ink-2))]/50 sm:px-6">
                        <div className="flex items-center justify-between gap-3">
                            <p className={cn(sectionEyebrow, "text-ink-6")}>One insight</p>
                            <button
                                type="button"
                                onClick={nextInsight}
                                className="text-xs font-medium text-[hsl(var(--accent-600))] underline-offset-4 hover:underline dark:text-[hsl(var(--accent-400))]"
                            >
                                Next ({takeawayIndex + 1}/{takeaways.length})
                            </button>
                        </div>
                        <p className="mt-2 font-display text-[1.05rem] font-light leading-snug text-ink-8">{takeaways[takeawayIndex]}</p>
                    </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-3/20 px-5 py-4 sm:px-6">
                    <div className="flex items-center gap-3 text-sm text-ink-5">
                        <RatingStars rating={item.rating} />
                        <span>{formatCount(item.readCount)} reads</span>
                    </div>
                    <Button type="button" variant="outline" className="rounded-full" onClick={onClose}>
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const PsychologicalContent = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState("");
    const [activeCollection, setActiveCollection] = useState<CollectionId>("all");
    const [typeFilter, setTypeFilter] = useState<ContentType | "all">("all");
    const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
    const [savedItems, setSavedItems] = useState<string[]>([]);
    const [showBookmarks, setShowBookmarks] = useState(false);

    const itemsWithCollection = useMemo(
        () => allContent.map((c) => ({ ...c, collection: deriveCollection(c) })),
        [],
    );

    const collectionCounts = useMemo(() => {
        const counts: Record<Exclude<CollectionId, "all">, number> = {
            "calm-now": 0,
            understand: 0,
            "live-well": 0,
        };
        for (const item of itemsWithCollection) counts[item.collection] += 1;
        return counts;
    }, [itemsWithCollection]);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(SAVED_KEY);
            if (raw) setSavedItems(JSON.parse(raw) as string[]);
        } catch {
            /* ignore */
        }
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem(SAVED_KEY, JSON.stringify(savedItems));
        } catch {
            /* ignore */
        }
    }, [savedItems]);

    const filteredContent = useMemo(() => {
        return itemsWithCollection.filter((item) => {
            const q = searchQuery.toLowerCase();
            const matchesSearch =
                item.title.toLowerCase().includes(q) ||
                item.description.toLowerCase().includes(q) ||
                item.tags.some((t) => t.toLowerCase().includes(q));
            const matchesCollection = activeCollection === "all" || item.collection === activeCollection;
            const matchesType = typeFilter === "all" || item.type === typeFilter;
            const matchesSaved = !showBookmarks || savedItems.includes(item.id);
            return matchesSearch && matchesCollection && matchesType && matchesSaved;
        });
    }, [itemsWithCollection, searchQuery, activeCollection, typeFilter, showBookmarks, savedItems]);

    const spotlightItem = useMemo(() => {
        if (showBookmarks || searchQuery.trim() || activeCollection !== "all" || typeFilter !== "all") return null;
        return allContent.find((c) => c.featured) ?? allContent[0] ?? null;
    }, [showBookmarks, searchQuery, activeCollection, typeFilter]);

    const gridItems = useMemo(() => {
        if (!spotlightItem) return filteredContent;
        const rest = filteredContent.filter((i) => i.id !== spotlightItem.id);
        if (rest.length === 0 && filteredContent.length > 0) return filteredContent;
        return rest;
    }, [filteredContent, spotlightItem]);

    const toggleBookmark = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (savedItems.includes(id)) {
            setSavedItems((prev) => prev.filter((i) => i !== id));
            toast({ title: "Removed", description: "Taken off your saved list." });
        } else {
            setSavedItems((prev) => [...prev, id]);
            toast({ title: "Saved", description: "We’ll keep this on your list in this browser." });
        }
    };

    return (
        <AppShell>
            <PageContainer as="div" width="wide" className="relative pb-12 pt-6 sm:pb-16 sm:pt-8">
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
                    style={{
                        backgroundImage:
                            "radial-gradient(720px 380px at 18% -8%, hsl(var(--warmth-50)) 0%, transparent 55%), radial-gradient(560px 320px at 92% 12%, hsl(var(--accent-50)) 0%, transparent 50%)",
                    }}
                />
                <header className="relative mx-auto max-w-3xl text-center">
                    <motion.p
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={enterTransition}
                        className={sectionEyebrow}
                    >
                        Resources
                    </motion.p>
                    <motion.h1
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...enterTransition, delay: 0.04 }}
                        className="mt-3 text-balance font-display text-[clamp(1.85rem,4.2vw,2.65rem)] font-light tracking-tight text-ink-8"
                    >
                        Read slowly.{" "}
                        <span className="text-[hsl(var(--accent-600))] dark:text-[hsl(var(--accent-400))]">Stay as long as you need.</span>
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...enterTransition, delay: 0.08 }}
                        className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-ink-6"
                    >
                        Evidence-informed guides and short practices — written for real study days, family rhythms, and the moments when your mind won’t quiet down.
                    </motion.p>
                </header>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...enterTransition, delay: 0.1 }}
                    className="mx-auto mt-10 flex max-w-2xl flex-col gap-3 sm:flex-row sm:items-center"
                >
                    <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2 text-ink-5" />
                        <Input
                            placeholder="Try sleep, boundaries, grounding…"
                            className="h-11 rounded-full border-ink-3/30 bg-[hsl(var(--card))]/80 pl-10 pr-4 text-[15px] shadow-dashboard-soft backdrop-blur-sm dark:border-ink-3/25"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            aria-label="Search resources"
                        />
                    </div>
                    <Button
                        type="button"
                        variant={showBookmarks ? "default" : "outline"}
                        className={cn(
                            "h-11 shrink-0 rounded-full px-5",
                            showBookmarks
                                ? "bg-[hsl(var(--accent-500))] text-white hover:bg-[hsl(var(--accent-600))]"
                                : "border-ink-3/30 bg-[hsl(var(--card))]/60",
                        )}
                        onClick={() => setShowBookmarks((v) => !v)}
                    >
                        {showBookmarks ? <BookmarkCheck className="mr-2 h-4 w-4" /> : <Bookmark className="mr-2 h-4 w-4" />}
                        Saved
                    </Button>
                </motion.div>

                {/* Three calm collections — primary navigation for the library */}
                <section aria-labelledby="resources-collections-heading" className="mx-auto mt-12 max-w-5xl">
                    <p id="resources-collections-heading" className={`${sectionEyebrow} mb-3 text-center sm:text-left`}>
                        Collections
                    </p>
                    <div className="grid gap-3 sm:grid-cols-3">
                        {collections
                            .filter((c) => c.id !== "all")
                            .map((c) => {
                                const Icon = c.icon;
                                const active = activeCollection === c.id;
                                const count = collectionCounts[c.id as Exclude<CollectionId, "all">];
                                return (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => setActiveCollection(active ? "all" : c.id)}
                                        aria-pressed={active}
                                        className={cn(
                                            "group relative flex flex-col items-start gap-3 overflow-hidden rounded-[1.25rem] border p-5 text-left transition-all",
                                            active
                                                ? "border-[hsl(var(--accent-400))]/45 bg-[hsl(var(--accent-50))]/55 shadow-md dark:border-[hsl(var(--accent-500))]/35 dark:bg-[hsl(var(--accent-100))]/15"
                                                : "border-ink-3/25 bg-[hsl(var(--card))] hover:-translate-y-0.5 hover:border-[hsl(var(--accent-400))]/30 hover:shadow-md dark:border-ink-3/20",
                                        )}
                                    >
                                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--accent-100))]/55 text-[hsl(var(--accent-600))] dark:bg-[hsl(var(--accent-100))]/15 dark:text-[hsl(var(--accent-400))]">
                                            <Icon className="h-4 w-4" strokeWidth={1.8} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-display text-[1.05rem] font-medium leading-snug text-ink-8">
                                                {c.label}
                                            </p>
                                            <p className="mt-1 text-[13px] leading-snug text-ink-6">{c.description}</p>
                                        </div>
                                        <span className="mt-auto text-[11.5px] font-medium uppercase tracking-[0.18em] text-ink-5">
                                            {count} {count === 1 ? "item" : "items"}
                                        </span>
                                    </button>
                                );
                            })}
                    </div>
                    {activeCollection !== "all" ? (
                        <button
                            type="button"
                            onClick={() => setActiveCollection("all")}
                            className="mt-3 text-[12.5px] font-medium text-[hsl(var(--accent-600))] underline-offset-4 hover:underline dark:text-[hsl(var(--accent-400))]"
                        >
                            ← Back to all resources
                        </button>
                    ) : null}
                </section>

                {/* Secondary format filter */}
                <div className="mx-auto mt-6 max-w-3xl">
                    <p className={`${sectionEyebrow} mb-2 text-center sm:text-left`}>Format</p>
                    <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:justify-center">
                        {typeFilters.map((tf) => {
                            const Icon = tf.icon;
                            const active = typeFilter === tf.id;
                            return (
                                <button
                                    key={tf.id}
                                    type="button"
                                    onClick={() => setTypeFilter(tf.id)}
                                    className={cn(
                                        "snap-start whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors",
                                        active
                                            ? "bg-ink-8 text-[hsl(var(--background))] dark:bg-ink-8 dark:text-white"
                                            : "border border-ink-3/25 bg-[hsl(var(--card))]/70 text-ink-7 hover:border-[hsl(var(--accent-400))]/40 hover:text-ink-8",
                                    )}
                                >
                                    <Icon className="mr-1.5 inline h-3.5 w-3.5 align-[-2px]" />
                                    {tf.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <section className="mt-14 space-y-4">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className={sectionEyebrow}>Guided reads</p>
                            <h2 className="mt-1 font-display text-xl font-light tracking-tight text-ink-8 sm:text-2xl">Full articles on the site</h2>
                        </div>
                        <p className="max-w-sm text-sm text-ink-6">Tap a card to open — made for reading without distractions.</p>
                    </div>
                    <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid lg:snap-none lg:grid-cols-5 lg:overflow-visible">
                        {longReadGuides.map((g) => (
                            <button
                                key={g.path}
                                type="button"
                                onClick={() => navigate(g.path)}
                                className={cn(
                                    "flex w-[min(88vw,280px)] shrink-0 snap-start flex-col rounded-[1.25rem] border border-ink-3/30 bg-[hsl(var(--card))] p-5 text-left shadow-dashboard-soft transition-all",
                                    "hover:-translate-y-0.5 hover:border-[hsl(var(--accent-400))]/35 hover:shadow-lg lg:w-auto dark:border-ink-3/25",
                                )}
                            >
                                <span className="text-3xl" aria-hidden>
                                    {g.emoji}
                                </span>
                                <p className={`${sectionEyebrow} mt-3 text-[hsl(var(--accent-600))] dark:text-[hsl(var(--accent-400))]`}>{g.kicker}</p>
                                <p className="mt-2 font-display text-lg font-normal leading-snug text-ink-8">{g.title}</p>
                                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-6">{g.description}</p>
                                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[hsl(var(--accent-600))] dark:text-[hsl(var(--accent-400))]">
                                    {g.readLabel}
                                    <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
                                </span>
                            </button>
                        ))}
                    </div>
                </section>

                {spotlightItem ? (
                    <section className="mt-16 space-y-6">
                        <FeaturedHeroCard item={spotlightItem} onOpen={setSelectedItem} />
                    </section>
                ) : null}

                <section className={cn("space-y-6", spotlightItem ? "mt-12" : "mt-16")}>
                    <div className="max-w-2xl">
                        <p className={sectionEyebrow}>Library</p>
                        <h2 className="mt-1 font-display text-xl font-light tracking-tight text-ink-8 sm:text-2xl">Short reads &amp; practices</h2>
                        <p className="mt-2 text-sm leading-relaxed text-ink-6 sm:text-[15px]">
                            Same calm tone as the rest of MindMitra — open anything to read slowly, or save it for later.
                        </p>
                    </div>
                    <AnimatePresence mode="popLayout">
                        {gridItems.length > 0 ? (
                            <motion.div
                                layout
                                className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
                            >
                                {gridItems.map((item) => (
                                    <ContentCard
                                        key={item.id}
                                        item={item}
                                        onOpen={setSelectedItem}
                                        bookmarked={savedItems.includes(item.id)}
                                        onToggleBookmark={toggleBookmark}
                                    />
                                ))}
                            </motion.div>
                        ) : (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="rounded-[1.5rem] border border-ink-3/25 bg-[hsl(var(--card))] py-16 text-center shadow-dashboard-soft"
                            >
                                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--ink-1))]">
                                    <Search className="h-6 w-6 text-ink-5" />
                                </div>
                                <h3 className="font-display text-xl font-normal text-ink-8">Nothing matches yet</h3>
                                <p className="mx-auto mt-2 max-w-sm text-sm text-ink-6">
                                    Try another word, topic, or format — or clear filters to see everything again.
                                </p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="mt-6 rounded-full"
                                    onClick={() => {
                                        setSearchQuery("");
                                        setActiveCollection("all");
                                        setTypeFilter("all");
                                        setShowBookmarks(false);
                                    }}
                                >
                                    Reset filters
                                </Button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </section>

                {/* Pre-footer CTA: card surface + asymmetric layout so it doesn’t compete with Footer crisis band */}
                <section
                    aria-labelledby="resources-cta-heading"
                    className="mt-14 border-t border-ink-3/20 pt-10 sm:mt-16 sm:pt-12"
                >
                    <div className="flex flex-col gap-8 rounded-[1.5rem] border border-ink-3/30 bg-[hsl(var(--card))] p-6 shadow-dashboard-soft sm:p-8 md:flex-row md:items-center md:justify-between md:gap-10 lg:rounded-[1.75rem] lg:p-10">
                        <div className="min-w-0 max-w-xl text-left">
                            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink-5">When reading isn’t enough</p>
                            <h2
                                id="resources-cta-heading"
                                className="mt-2 font-display text-[clamp(1.35rem,3.2vw,1.85rem)] font-light leading-snug tracking-tight text-ink-8"
                            >
                                Prefer to sit with someone gentle?
                            </h2>
                            <p className="mt-3 text-[15px] leading-relaxed text-ink-6">
                                Chat stays open — peer support is there when you want company alongside the words.
                            </p>
                        </div>
                        <div className="flex w-full shrink-0 flex-col gap-3 sm:flex-row sm:justify-end md:w-auto md:flex-col lg:flex-row">
                            <Button
                                type="button"
                                className="h-11 rounded-full bg-[hsl(var(--accent-500))] px-8 text-[15px] font-semibold text-white shadow-md hover:bg-[hsl(var(--accent-600))] dark:hover:bg-[hsl(var(--accent-400))]"
                                onClick={() => navigate("/chat")}
                            >
                                Open chat
                                <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.8} />
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                className="h-11 rounded-full border-ink-3/30 bg-transparent px-8 hover:bg-[hsl(var(--ink-1))]/50"
                                onClick={() => navigate("/peer-support")}
                            >
                                Peer support
                                <Users className="ml-2 h-4 w-4" strokeWidth={1.8} />
                            </Button>
                        </div>
                    </div>
                </section>
            </PageContainer>

            <ResourceReaderDialog item={selectedItem} open={!!selectedItem} onClose={() => setSelectedItem(null)} />

            <Footer className="mt-10 sm:mt-14" />
        </AppShell>
    );
};

export default PsychologicalContent;

