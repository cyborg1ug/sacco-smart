import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { phone, password, fullName, nationalId, occupation, address } = await req.json()

    if (!phone || !password || !fullName) {
      return new Response(
        JSON.stringify({ error: 'Phone number, password, and full name are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if phone number already exists
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('phone_number', phone)
      .maybeSingle()

    if (existingProfile) {
      return new Response(
        JSON.stringify({ error: 'An account with this phone number already exists' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '')
    const generatedEmail = `member_${cleanPhone}@kinoni-sacco.local`

    // Create user with auto-confirmed email (phone users can't verify a fake email)
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: generatedEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update profile with additional info
    if (data.user) {
      await supabaseAdmin.from('profiles').update({
        phone_number: phone,
        national_id: nationalId || null,
        occupation: occupation || null,
        address: address || null,
      }).eq('id', data.user.id)
    }

    return new Response(
      JSON.stringify({ data: { email: generatedEmail, userId: data.user?.id }, error: null }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in signup-phone function:', error)
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
