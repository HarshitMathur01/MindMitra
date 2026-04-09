import { useState, useMemo } from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import {
    BookOpen,
    Play,
    Headphones,
    FileText,
    Clock,
    Star,
    Search,
    Heart,
    ExternalLink,
    ChevronRight,
    Brain,
    Sparkles,
    TrendingUp,
    Shield,
    ArrowRight,
    Bookmark,
    BookmarkCheck,
    CheckCircle2,
    Lightbulb,
    Users,
    GraduationCap,
    Flower2,
    Activity,
    X,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

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

interface ContentCategory {
    id: string;
    label: string;
    icon: React.ElementType;
    description: string;
    color: string;
}

// ─── Categories ───────────────────────────────────────────────────────────────

const contentCategories: ContentCategory[] = [
    { id: "all", label: "All Topics", icon: Sparkles, description: "Browse everything", color: "primary" },
    { id: "stress-management", label: "Stress Management", icon: Activity, description: "Cope with daily pressures", color: "teal" },
    { id: "anxiety", label: "Understanding Anxiety", icon: Brain, description: "Learn about anxiety patterns", color: "blue" },
    { id: "self-esteem", label: "Self-Esteem", icon: Heart, description: "Build confidence from within", color: "pink" },
    { id: "study-skills", label: "Study & Focus", icon: GraduationCap, description: "Study smarter, not harder", color: "amber" },
    { id: "relationships", label: "Relationships", icon: Users, description: "Healthy connection skills", color: "violet" },
    { id: "mindfulness", label: "Mindfulness", icon: Flower2, description: "Present-moment awareness", color: "green" },
    { id: "cbt-techniques", label: "CBT Techniques", icon: Lightbulb, description: "Cognitive behavioral tools", color: "orange" },
];

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

const typeColorMap: Record<ContentType, string> = {
    article: "bg-primary/10 text-primary",
    video: "bg-red-500/10 text-red-600 dark:text-red-400",
    audio: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    exercise: "bg-green-500/10 text-green-600 dark:text-green-400",
};

const difficultyColors: Record<DifficultyLevel, string> = {
    beginner: "bg-green-500/10 text-green-600 dark:text-green-400",
    intermediate: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    advanced: "bg-red-500/10 text-red-600 dark:text-red-400",
};

const categoryColorMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    teal: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
    blue: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
    pink: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    green: "bg-green-500/10 text-green-600 dark:text-green-400",
    orange: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
};

const activeCatColorMap: Record<string, string> = {
    primary: "bg-primary text-white",
    teal: "bg-teal-500 text-white",
    blue: "bg-primary text-white",
    pink: "bg-pink-500 text-white",
    amber: "bg-amber-500 text-white",
    violet: "bg-violet-500 text-white",
    green: "bg-green-500 text-white",
    orange: "bg-orange-500 text-white",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const ContentTypeChip = ({ type }: { type: ContentType }) => {
    const Icon = typeIconMap[type];
    return (
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${typeColorMap[type]}`}>
            <Icon className="h-3 w-3" />
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
            <span className="text-xs ml-1 text-muted-foreground font-medium">{rating}</span>
        </span>
    );
};

// ─── Content Card ─────────────────────────────────────────────────────────────

const ContentCard = ({
    item,
    onOpen,
    bookmarked,
    onToggleBookmark,
}: {
    item: ContentItem;
    onOpen: (item: ContentItem) => void;
    bookmarked: boolean;
    onToggleBookmark: (id: string) => void;
}) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            whileHover={{ y: -2 }}
        >
            <Card
                className="relative overflow-hidden rounded-2xl border border-border/60 bg-surface transition-all duration-200 hover:shadow-lg cursor-pointer group"
                style={{ boxShadow: "0 2px 16px var(--shadow)" }}
                onClick={() => onOpen(item)}
            >
                {/* Featured badge */}
                {item.featured && (
                    <div className="absolute top-3 right-3 z-10">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                            <Sparkles className="h-3 w-3" />
                            Featured
                        </span>
                    </div>
                )}

                {/* Content area */}
                <div className="p-5">
                    {/* Emoji header + type */}
                    <div className="flex items-start gap-3 mb-3">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl shrink-0">
                            {item.imageEmoji}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                <ContentTypeChip type={item.type} />
                                <span className={`text-xs px-2 py-0.5 rounded-full ${difficultyColors[item.difficulty]} capitalize`}>
                                    {item.difficulty}
                                </span>
                            </div>
                            <h3 className="font-bold text-foreground text-base leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                                {item.title}
                            </h3>
                        </div>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-4">
                        {item.description}
                    </p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 mb-4">
                        {item.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-background text-muted-foreground/80 border border-border/40">
                                #{tag}
                            </span>
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {item.duration}
                            </span>
                            <RatingStars rating={item.rating} />
                            <span>{formatCount(item.readCount)} reads</span>
                        </div>

                        <button
                            onClick={(e) => { e.stopPropagation(); onToggleBookmark(item.id); }}
                            className={`p-1.5 rounded-lg transition-colors ${bookmarked ? "text-primary" : "text-muted-foreground/40 hover:text-primary"
                                }`}
                        >
                            {bookmarked ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                        </button>
                    </div>
                </div>
            </Card>
        </motion.div>
    );
};

// ─── Featured Hero Card ───────────────────────────────────────────────────────

const FeaturedHeroCard = ({ item, onOpen }: { item: ContentItem; onOpen: (item: ContentItem) => void }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
    >
        <Card
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-surface to-accent/5 border border-primary/20 cursor-pointer group"
            style={{ boxShadow: "0 4px 24px var(--shadow)" }}
            onClick={() => onOpen(item)}
        >
            <div className="p-6 md:p-8 flex flex-col md:flex-row gap-6">
                <div className="w-20 h-20 rounded-2xl bg-primary/15 flex items-center justify-center text-5xl shrink-0">
                    {item.imageEmoji}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                            <Sparkles className="h-3 w-3" />
                            Editor's Pick
                        </span>
                        <ContentTypeChip type={item.type} />
                    </div>
                    <h2 className="text-xl md:text-2xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                        {item.title}
                    </h2>
                    <p className="text-muted-foreground leading-relaxed mb-4 line-clamp-2">{item.description}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4" />
                            {item.duration}
                        </span>
                        <RatingStars rating={item.rating} />
                        <span>{formatCount(item.readCount)} reads</span>
                        <span className="text-xs">by {item.author}</span>
                    </div>
                </div>
                <div className="hidden md:flex items-center">
                    <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                        <ArrowRight className="h-5 w-5" />
                    </div>
                </div>
            </div>
        </Card>
    </motion.div>
);

// ─── Content Detail Modal ─────────────────────────────────────────────────────

const ContentDetailModal = ({
    item,
    open,
    onClose,
}: {
    item: ContentItem | null;
    open: boolean;
    onClose: () => void;
}) => {
    if (!item) return null;

    return (
        <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-surface border-border/60 rounded-2xl p-0">
                {/* Header */}
                <div className="p-6 border-b border-border/40">
                    <div className="flex items-start gap-4">
                        <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-3xl shrink-0">
                            {item.imageEmoji}
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <ContentTypeChip type={item.type} />
                                <span className={`text-xs px-2 py-0.5 rounded-full ${difficultyColors[item.difficulty]} capitalize`}>
                                    {item.difficulty}
                                </span>
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3" /> {item.duration}
                                </span>
                            </div>
                            <h2 className="text-xl font-bold text-foreground leading-snug">{item.title}</h2>
                            <p className="text-sm text-muted-foreground mt-1.5">
                                by <span className="font-medium text-foreground">{item.author}</span> — {item.authorCredential}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {/* Long description – render with line breaks and basic formatting */}
                    <div className="prose prose-sm max-w-none text-muted-foreground leading-relaxed">
                        {item.longDescription.split("\n\n").map((paragraph, idx) => (
                            <p key={idx} className="mb-4 last:mb-0 whitespace-pre-line">{paragraph}</p>
                        ))}
                    </div>

                    {/* Key takeaways */}
                    <div className="bg-primary/5 rounded-2xl p-5 border border-primary/15">
                        <h3 className="font-bold text-foreground flex items-center gap-2 mb-3">
                            <Lightbulb className="h-5 w-5 text-primary" />
                            Key Takeaways
                        </h3>
                        <ul className="space-y-2">
                            {item.keyTakeaways.map((takeaway, idx) => (
                                <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                    <span>{takeaway}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-2">
                        {item.tags.map((tag) => (
                            <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-background text-muted-foreground border border-border/40">
                                #{tag}
                            </span>
                        ))}
                    </div>

                    {/* Stats bar */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2 border-t border-border/30">
                        <RatingStars rating={item.rating} />
                        <span>{formatCount(item.readCount)} reads</span>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const PsychologicalContent = () => {
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState<string>("all");
    const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
    const [savedItems, setSavedItems] = useState<string[]>([]);
    const [showBookmarks, setShowBookmarks] = useState(false);

    // Categories setup
    const allCategories = contentCategories;

    // Filter logic
    const filteredContent = useMemo(() => {
        return allContent.filter(item => {
            const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                  item.description.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesTab = activeTab === "all" || item.category === activeTab;
            const matchesSaved = !showBookmarks || savedItems.includes(item.id);
            return matchesSearch && matchesTab && matchesSaved;
        });
    }, [searchQuery, activeTab, showBookmarks, savedItems]);

    const toggleBookmark = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (savedItems.includes(id)) {
            setSavedItems(prev => prev.filter(i => i !== id));
            toast({ title: "Removed from saved items", description: "This resource has been removed from your bookmarks." });
        } else {
            setSavedItems(prev => [...prev, id]);
            toast({ title: "Saved for later", description: "You can find this resource in your bookmarks." });
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col font-sans">
            <Header />

            <main className="flex-1">
                {/* HERO SECTION */}
                <section className="pt-24 pb-12 px-6 lg:px-12 max-w-5xl mx-auto text-center space-y-6">
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                        <Badge variant="outline" className="mb-4 px-4 py-1.5 text-sm font-medium border-primary/20 text-primary bg-primary/5 rounded-full">
                            <Sparkles className="h-4 w-4 mr-2" /> Mindful Resources
                        </Badge>
                        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-foreground">
                            Discover peace of mind.
                        </h1>
                        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                            Curated articles, guided audio, and exercises designed to support your journey toward mental clarity and well-being.
                        </p>
                    </motion.div>

                    {/* SEARCH & FILTERS */}
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        transition={{ duration: 0.4, delay: 0.1 }}
                        className="max-w-2xl mx-auto pt-6 flex flex-col sm:flex-row gap-4"
                    >
                        <div className="relative flex-1">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <Input 
                                placeholder="Search 'anxiety', 'sleep', 'focus'..." 
                                className="w-full pl-11 pr-4 py-6 rounded-2xl bg-card border-border shadow-sm text-base focus-visible:ring-1 focus-visible:ring-primary"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Button 
                            variant={showBookmarks ? "default" : "outline"}
                            className="py-6 px-6 rounded-2xl gap-2 font-medium"
                            onClick={() => setShowBookmarks(!showBookmarks)}
                        >
                            {showBookmarks ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
                            {showBookmarks ? "Saved" : "Saved"}
                        </Button>
                    </motion.div>

                    {/* CATEGORY PILLS */}
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="flex flex-wrap items-center justify-center gap-2 pt-8"
                    >
                        {allCategories.map(cat => {
                            const Icon = cat.icon;
                            const isActive = activeTab === cat.id;
                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveTab(cat.id)}
                                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200 ${
                                        isActive 
                                            ? "bg-foreground text-background shadow-md" 
                                            : "bg-secondary/50 text-secondary-foreground hover:bg-secondary border border-transparent hover:border-border"
                                    }`}
                                >
                                    {Icon && <Icon className="h-4 w-4" />}
                                    {cat.label}
                                </button>
                            );
                        })}
                    </motion.div>
                </section>

                {/* CONTENT GRID */}
                <section className="max-w-7xl mx-auto px-6 lg:px-12 pb-24">
                    <AnimatePresence mode="popLayout">
                        {filteredContent.length > 0 ? (
                            <motion.div 
                                layout
                                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                            >
                                {filteredContent.map((item, i) => (
                                    <motion.div
                                        key={item.id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.95, y: 15 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ duration: 0.25, delay: i * 0.05 }}
                                    >
                                        <Card 
                                            className="group h-full flex flex-col bg-card border border-border hover:border-primary/30 rounded-3xl overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                                            onClick={() => setSelectedItem(item)}
                                        >
                                            {/* Card Image Area (Simulated abstract colored header) */}
                                            <div className={`h-32 bg-gradient-to-br from-primary/10 to-transparent relative p-5 flex flex-col justify-between`}>
                                                <div className="flex justify-between items-start">
                                                    <Badge variant="secondary" className="bg-background/80 backdrop-blur border-none font-medium capitalize flex gap-1.5 items-center shadow-sm">
                                                        {item.type === 'video' ? <Play className="h-3 w-3" /> : item.type === 'audio' ? <Headphones className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                                                        {item.type}
                                                    </Badge>
                                                    <button 
                                                        onClick={(e) => toggleBookmark(item.id, e)}
                                                        className="p-2 rounded-full bg-background/50 hover:bg-background/80 backdrop-blur transition-colors text-foreground"
                                                    >
                                                        {savedItems.includes(item.id) ? <BookmarkCheck className="h-4 w-4 text-primary" /> : <Bookmark className="h-4 w-4" />}
                                                    </button>
                                                </div>
                                            </div>
                                            
                                            {/* Card Content */}
                                            <div className="p-6 flex flex-col flex-1">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">{item.category}</span>
                                                    <span className="w-1 h-1 rounded-full bg-muted-foreground/30"></span>
                                                    <span className="text-xs text-muted-foreground flex items-center"><Clock className="h-3 w-3 mr-1" /> {item.readTime}</span>
                                                </div>
                                                <h3 className="text-xl font-semibold leading-tight mb-2 text-foreground group-hover:text-primary transition-colors line-clamp-2">
                                                    {item.title}
                                                </h3>
                                                <p className="text-sm text-muted-foreground line-clamp-3 mb-6 leading-relaxed flex-1">
                                                    {item.description}
                                                </p>
                                                
                                                {/* Author/Action Footer */}
                                                <div className="mt-auto pt-4 border-t border-border flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                                                            {item.author.charAt(0)}
                                                        </div>
                                                        <span className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">{item.author}</span>
                                                    </div>
                                                    <div className="text-primary opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                                                        <ArrowRight className="h-5 w-5" />
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                    </motion.div>
                                ))}
                            </motion.div>
                        ) : (
                            <motion.div 
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                className="py-24 text-center max-w-md mx-auto"
                            >
                                <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
                                    <Search className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <h3 className="text-xl font-semibold text-foreground mb-2">No resources found</h3>
                                <p className="text-muted-foreground mb-6">We couldn't track down anything for "{searchQuery}". Try a different keyword or category.</p>
                                <Button onClick={() => { setSearchQuery(""); setActiveTab("all"); }} variant="outline" className="rounded-xl">
                                    Clear Filters
                                </Button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </section>

                {/* BOTTOM CTA: NEED HELP? */}
                <section className="bg-primary/5 py-16 border-t border-border">
                    <div className="max-w-4xl mx-auto px-6 text-center space-y-6">
                        <Heart className="h-10 w-10 text-primary mx-auto opacity-80" />
                        <h2 className="text-3xl font-semibold">Feeling overwhelmed right now?</h2>
                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                            Sometimes an article isn't enough. Our AI companion is available 24/7 to listen, or you can instantly connect with our community or specialized crisis resources.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                            <Button className="rounded-full px-8 py-6 text-base font-semibold shadow-xl shadow-primary/20" onClick={() => window.location.href = '/chat'}>
                                Talk to MindMitra <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                            <Button variant="outline" className="rounded-full px-8 py-6 text-base font-semibold bg-background" onClick={() => window.location.href = '/peer-support'}>
                                Join Peer Support <Users className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </section>

            </main>

            <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    {selectedItem && (
                        <>
                            <DialogHeader>
                                <div className="flex items-center gap-2 mb-2">
                                    <Badge variant="outline" className="capitalize">{selectedItem.type}</Badge>
                                    <span className="text-sm text-muted-foreground"><Clock className="inline w-3 h-3 mr-1" />{selectedItem.duration}</span>
                                </div>
                                <DialogTitle className="text-2xl font-bold">{selectedItem.title}</DialogTitle>
                            </DialogHeader>
                            <div className="my-6">
                                <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{selectedItem.longDescription || selectedItem.description}</p>
                            </div>
                            
                            {selectedItem.keyTakeaways && selectedItem.keyTakeaways.length > 0 && (
                                <div className="bg-primary/5 p-5 rounded-2xl border border-primary/10">
                                    <h4 className="font-semibold mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary"/> Key Takeaways</h4>
                                    <ul className="space-y-2 text-sm text-muted-foreground">
                                        {selectedItem.keyTakeaways.map((takeaway: string, idx: number) => (
                                            <li key={idx} className="flex items-start gap-2">
                                                <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                                <span>{takeaway}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 mt-6">
                                {selectedItem.link && (
                                    <Button onClick={() => window.open(selectedItem.link, "_blank")} className="rounded-full">
                                        Open External Resource <ExternalLink className="w-4 h-4 ml-2" />
                                    </Button>
                                )}
                                <Button variant="outline" onClick={() => setSelectedItem(null)} className="rounded-full">
                                    Close
                                </Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <Footer />

        </div>
    );
};

export default PsychologicalContent;

