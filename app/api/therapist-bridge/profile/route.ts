import { NextRequest, NextResponse } from 'next/server';

const buildMockProfile = () => ({
  moodTrends: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString(),
    mood: Math.floor(Math.random() * 4) + 5,
  })),
  patterns: [
    {
      icon: '🌙',
      title: 'Late Night Anxiety',
      description: 'You often feel anxious late at night, especially between 11 PM - 1 AM',
    },
    {
      icon: '📚',
      title: 'Exam Stress',
      description: 'Stress levels peak around exam periods (2-3 weeks before exams)',
    },
    {
      icon: '✍️',
      title: 'Journaling Benefits',
      description: 'Journaling helps improve your mood by an average of 23%',
    },
  ],
  topics: [
    { topic: 'Family Pressure', frequency: 45, sentiment: -0.3 },
    { topic: 'Academic Stress', frequency: 38, sentiment: -0.5 },
    { topic: 'Career Anxiety', frequency: 32, sentiment: -0.2 },
    { topic: 'Loneliness', frequency: 28, sentiment: -0.4 },
    { topic: 'Self-Doubt', frequency: 25, sentiment: -0.6 },
  ],
  assessments: [
    { type: 'PHQ-9', score: 12, severity: 'Moderate depression', date: '2024-01-15' },
    { type: 'GAD-7', score: 14, severity: 'Moderate anxiety', date: '2024-01-20' },
    { type: 'WEMWBS', score: 42, severity: 'Below average wellbeing', date: '2024-01-22' },
  ],
  crisisEvents: [
    {
      date: '2024-01-10',
      severity: 'moderate',
      actionTaken: 'Immediate support provided, escalated to MNNIT counselor',
    },
  ],
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body?.userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    return NextResponse.json(buildMockProfile(), { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate profile', details: String(error) }, { status: 500 });
  }
}
