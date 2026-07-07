import { createClient } from '@supabase/supabase-js';

/* Supabase 프로젝트: mmm-market (구 inshow-agant-seoul)
   ⚠️ 이 프로젝트에는 inshow 앱 데이터도 함께 있다 — mmm_ 접두사 테이블만 사용할 것.
   publishable 키는 공개용으로 설계된 키 — RLS 정책이 실제 권한을 통제한다 */
export const SUPABASE_URL = 'https://xqaktggctlzistkvnnhr.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_QNhrV4GxeU10JLJpnbk7Sg_ATRpB_Hv';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
