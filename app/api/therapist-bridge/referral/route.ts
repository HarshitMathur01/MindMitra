import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body?.userId || !body?.therapistId || !body?.consent || !body?.profileSnapshot) {
      return NextResponse.json({ error: 'Missing required referral fields' }, { status: 400 });
    }

    const referral = {
      id: `ref-${body.therapistId}-${Date.now()}`,
      status: 'created',
    };

    return NextResponse.json(referral, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Unable to create referral', details: String(error) }, { status: 500 });
  }
}
