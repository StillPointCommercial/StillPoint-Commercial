import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildDigestHtml } from '@/lib/email/templates'

export async function GET(request: Request) {
  // Verify cron secret (Vercel cron sends this header)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const today = new Date().toISOString().split('T')[0]

  const { data: overdueContacts, error } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, company, next_action, next_action_date')
    .not('next_action', 'is', null)
    .lte('next_action_date', today)
    .order('next_action_date', { ascending: true })

  if (error) {
    console.error('Daily digest query error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!overdueContacts || overdueContacts.length === 0) {
    return NextResponse.json({ message: 'No overdue items, no email sent' })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://stillpoint-cis.vercel.app'

  const items = overdueContacts.map(c => ({
    contactName: `${c.first_name} ${c.last_name || ''}`.trim(),
    company: c.company,
    action: c.next_action!,
    daysOverdue: Math.floor((Date.now() - new Date(c.next_action_date).getTime()) / (1000 * 60 * 60 * 24)),
    contactUrl: `${appUrl}/contacts/${c.id}`,
  }))

  const html = buildDigestHtml(items, appUrl)

  // Send via Resend
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: `StillPoint CIS <${process.env.EMAIL_FROM || 'onboarding@resend.dev'}>`,
          to: process.env.DIGEST_RECIPIENT_EMAIL || 'wouter@stillpoint.com',
          subject: `StillPoint: ${items.length} overdue action${items.length !== 1 ? 's' : ''}`,
          html,
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        console.error('Resend error:', err)
        return NextResponse.json({ error: 'Email send failed' }, { status: 500 })
      }
    } catch (error: any) {
      console.error('Email send error:', error?.message || error)
      return NextResponse.json({ error: 'Email send failed. Please try again.' }, { status: 500 })
    }
  }

  return NextResponse.json({
    message: `Digest sent with ${items.length} overdue items`,
  })
}
