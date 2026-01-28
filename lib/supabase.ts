import { createClient } from '@supabase/supabase-js';

// Colocamos as chaves direto aqui para garantir que funcione no Firebase
const supabaseUrl = 'https://bxjjgbnbiyxpnauiiniy.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4ampnYm5iaXl4cG5hdWlpbml5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzNDI4NDksImV4cCI6MjA3OTkxODg0OX0.G4qO8N2t8i9A9F-goOzfJgB3CCgveC9e_XvEByoQB-Y';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);