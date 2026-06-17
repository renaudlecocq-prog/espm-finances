import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  || 'https://iubxalsakqljilydnqss.supabase.co'
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1YnhhbHNha3FsamlseWRucXNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0NTEzOTcsImV4cCI6MjA5NzAyNzM5N30.wuZeS9ZNbJR5xUWiW28KBsOWEe0rpjluNPS4sM0CY7Q'

export const supabase = createClient(supabaseUrl, supabaseKey)
