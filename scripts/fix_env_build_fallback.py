from pathlib import Path
Path('lib/supabaseClient.ts').write_text("import { createClient } from '@supabase/supabase-js';\n\nconst url=process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co';\nconst key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-publishable-key';\nexport const supabase=createClient(url,key);\n",encoding='utf-8')
