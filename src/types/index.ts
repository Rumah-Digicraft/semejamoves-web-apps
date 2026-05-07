export type SportType = 'funminton' | 'padel' | 'basketball' | 'volleyball';

export interface SportConfig {
  sport_type: SportType;
  name: string;
  is_active: boolean;
  default_price: number;
  max_participants: number;
  icon: string;
  color: string;
}

export interface Session {
  id: string;
  sport_type: SportType;
  session_date: string;
  venue: string;
  max_participants: number;
  price_per_person: number;
  court_cost: number;
  other_cost: number;
  other_cost_description: string | null;
  notes: string | null;
  token: string;
  status: 'open' | 'closed' | 'done';
  created_at: string;
  sports_config?: SportConfig;
}

export interface Participant {
  id: string;
  session_id: string;
  name: string;
  phone: string | null;
  attended: boolean;
  payment_status: 'pending' | 'approved' | 'rejected';
  payment_amount: number | null;
  payment_date: string | null;
  payment_proof_url: string | null;
  ocr_raw: any | null;
  ocr_match: boolean | null;
  submitted_at: string | null;
  created_at: string;
}

export interface CashflowEntry {
  id: string;
  session_id: string | null;
  sport_type: SportType;
  entry_date: string;
  category: 'income' | 'outcome';
  description: string;
  amount: number;
  source: 'auto' | 'manual';
  notes: string | null;
  created_at: string;
}
