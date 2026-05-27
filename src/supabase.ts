import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://xwbrohzybbtkhusxlrty.supabase.co'
const SUPABASE_KEY = 'sb_publishable_UEE5PS_oU4UHQunrTFeJkA_FJATszEr'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
