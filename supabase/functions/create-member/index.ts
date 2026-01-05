import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Verify the caller is authenticated and is an admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.log('No authorization header provided')
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      console.log('Auth error:', authError?.message)
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if the user has admin role
    const { data: role, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single()

    if (roleError || !role) {
      console.log('User is not an admin:', user.id)
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { email, password, fullName, phoneNumber, parentAccountId, isSubAccount } = await req.json()

    // Handle sub-account creation (no auth user needed)
    if (isSubAccount && parentAccountId) {
      if (!fullName) {
        return new Response(
          JSON.stringify({ error: 'Full name is required for sub-account' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('Creating sub-account under parent:', parentAccountId)

      // Get the parent account to get the user_id
      const { data: parentAccount, error: parentError } = await supabaseAdmin
        .from('accounts')
        .select('user_id')
        .eq('id', parentAccountId)
        .single()

      if (parentError || !parentAccount) {
        console.log('Parent account not found:', parentError?.message)
        return new Response(
          JSON.stringify({ error: 'Parent account not found' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Generate account number for sub-account
      const accountNumber = 'ACC' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + 
        Math.floor(Math.random() * 10000).toString().padStart(4, '0')

      // Create the sub-account linked to the same user_id as parent
      const { data: newAccount, error: accountError } = await supabaseAdmin
        .from('accounts')
        .insert({
          user_id: parentAccount.user_id,
          account_number: accountNumber,
          account_type: 'sub',
          parent_account_id: parentAccountId,
          balance: 0,
          total_savings: 0
        })
        .select()
        .single()

      if (accountError) {
        console.log('Error creating sub-account:', accountError.message)
        return new Response(
          JSON.stringify({ error: accountError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Create sub-account profile
      const { error: profileError } = await supabaseAdmin
        .from('sub_account_profiles')
        .insert({
          account_id: newAccount.id,
          full_name: fullName,
          phone_number: phoneNumber || null,
        })

      if (profileError) {
        console.log('Error creating sub-account profile:', profileError.message)
        // Clean up the account if profile creation fails
        await supabaseAdmin.from('accounts').delete().eq('id', newAccount.id)
        return new Response(
          JSON.stringify({ error: profileError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('Sub-account created successfully:', newAccount.id)

      return new Response(
        JSON.stringify({ data: { account: newAccount }, error: null }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Regular member creation (with auth user)
    // Email is optional - if not provided, generate a placeholder email using phone number
    if (!password || !fullName) {
      return new Response(
        JSON.stringify({ error: 'Password and full name are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate email if not provided (use phone number or timestamp-based email)
    let userEmail = email
    if (!userEmail || userEmail.trim() === '') {
      const cleanPhone = phoneNumber?.replace(/\D/g, '') || Date.now().toString()
      userEmail = `member_${cleanPhone}@kinoni.local`
    }

    console.log('Creating member with email:', userEmail)

    // Create the user with admin API
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: userEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    })

    if (error) {
      console.log('Error creating user:', error.message)
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Optionally update phone number in profiles table
    if (phoneNumber && data.user) {
      await supabaseAdmin
        .from('profiles')
        .update({ phone_number: phoneNumber })
        .eq('id', data.user.id)
    }

    console.log('Member created successfully:', data.user?.id)

    return new Response(
      JSON.stringify({ data, error: null }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in create-member function:', error)
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})