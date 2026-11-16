import { createClient } from '@supabase/supabase-js';

// Thay thế 2 biến dưới đây bằng thông tin thật của dự án Supabase của bạn
const supabaseUrl = 'https://xpnnmdtgptjtxvocgdhg.supabase.co';
const supabaseAnonKey = 'sb_publishable_6_kqWkbj9RwcdQx_p4hfIg_-ZaXH-si';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
