import { createClient } from '@supabase/supabase-js'

const supabase = createClient('https://karicofqdnjjmmbjgmtx.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imthcmljb2ZxZG5qam1tYmpnbXR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTYyMjM2OSwiZXhwIjoyMDY3MTk4MzY5fQ.Ck0cEsoa_O7UZtJfHalUhbOZC0SUtq01Hj-asKghLLY') // 用 service_role_key

async function createUser(email, password, username) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    user_metadata: { username }
  })
  if (error) console.error(error)
  else console.log('Created:', data.user.email)
}

createUser('user4.test@example.com', 'password123', 'user4')
createUser('user5.test@example.com', 'password123', 'user5')
createUser('user6.test@example.com', 'password123', 'user6')
