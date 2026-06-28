import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type Profile = {
  id: string
  email: string | null
  display_name: string | null
  org: string | null
  role: 'client' | 'owner'
  org_id: string | null
}

/** Current user + their profile (or nulls when signed out / not provisioned). */
export async function getProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, profile: null as Profile | null }
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, display_name, org, role, org_id')
    .eq('id', user.id)
    .maybeSingle()
  return { supabase, user, profile: profile as Profile | null }
}

export async function requireProfile() {
  const { supabase, user, profile } = await getProfile()
  if (!user) redirect('/login')
  if (!profile) redirect('/login?error=not_invited')
  return { supabase, user, profile: profile! }
}

/** Gate a tool route. Redirects to the launcher when the user lacks access. */
export async function requireTool(slug: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: ok } = await supabase.rpc('has_tool', { slug })
  if (!ok) redirect('/')
  return user
}

export async function requireOwner() {
  const { user, profile } = await getProfile()
  if (!user) redirect('/login')
  if (profile?.role !== 'owner') redirect('/')
  return profile!
}
