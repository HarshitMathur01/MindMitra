// Types for Profile & Settings pages

export interface UserProfile {
    id?: string;
    user_id: string;
    display_name: string;
    full_name?: string;
    age?: number;
    date_of_birth?: string;
    gender?: 'male' | 'female' | 'non-binary' | 'prefer-not-to-say';
    language?: 'hindi' | 'english' | 'hinglish';
    college?: string;
    course_year?: string;
    city?: string;
    avatar_url?: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    streak_days?: number;
    created_at?: string;
    updated_at?: string;
    // Privacy toggles for each field
    privacy_full_name?: boolean;
    privacy_age?: boolean;
    privacy_gender?: boolean;
    privacy_college?: boolean;
    privacy_course_year?: boolean;
    privacy_city?: boolean;
}

export interface UserSettings {
    id?: string;
    user_id: string;
    // General
    companion_name: string;
    avatar_personality: 'calm' | 'energetic' | 'analytical';
    companion_personality: 'mitra' | 'arjun' | 'diya' | 'riya' | 'zen';
    companion_personality_locked?: boolean;
    reminder_time?: string;
    language: 'hindi' | 'english' | 'hinglish';
    theme: 'light' | 'dark' | 'auto';
    // Privacy
    privacy_data_sharing: boolean;
    privacy_therapist_share: boolean;
    privacy_crisis_alert: boolean;
    data_retention_days: number;
    // Notifications
    notif_daily: boolean;
    notif_weekly: boolean;
    notif_therapist: boolean;
    notif_crisis: boolean;
    notif_daily_time?: string;
    notif_channels: string[];  // ['push', 'whatsapp', 'email']
    // Accessibility
    font_size: 'small' | 'medium' | 'large';
    high_contrast: boolean;
    reduce_animations: boolean;
    screen_reader: boolean;
    text_to_speech: boolean;
    // Meta
    updated_at?: string;
}

export interface MentalHealthSnapshot {
    stress_triggers: string[];
    emotional_trend: 'improving' | 'stable' | 'declining';
    trend_data: { date: string; score: number }[];
    sessions_completed: number;
    therapist_status: string | null;
    therapist_name: string | null;
}

export const DEFAULT_PROFILE: Omit<UserProfile, 'user_id'> = {
    display_name: '',
    full_name: '',
    gender: undefined,
    language: 'english',
    college: '',
    course_year: '',
    city: '',
    avatar_url: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    streak_days: 0,
    privacy_full_name: true,
    privacy_age: true,
    privacy_gender: true,
    privacy_college: true,
    privacy_course_year: true,
    privacy_city: true,
};

export const DEFAULT_SETTINGS: Omit<UserSettings, 'user_id'> = {
    companion_name: 'Mitra',
    avatar_personality: 'calm',
    companion_personality: 'mitra',
    reminder_time: '09:00',
    language: 'english',
    theme: 'auto',
    privacy_data_sharing: false,
    privacy_therapist_share: false,
    privacy_crisis_alert: true,
    data_retention_days: 90,
    notif_daily: true,
    notif_weekly: true,
    notif_therapist: true,
    notif_crisis: true,
    notif_daily_time: '09:00',
    notif_channels: ['push'],
    font_size: 'medium',
    high_contrast: false,
    reduce_animations: false,
    screen_reader: false,
    text_to_speech: false,
};

export const HELPLINE_CONTACTS = [
    { name: 'iCall', phone: '9152987821', description: 'Psychosocial Helpline by TISS' },
    { name: 'Vandrevala Foundation', phone: '18602662345', description: '24/7 Mental Health Helpline' },
    { name: 'NIMHANS', phone: '08046110007', description: 'National Institute of Mental Health' },
];
