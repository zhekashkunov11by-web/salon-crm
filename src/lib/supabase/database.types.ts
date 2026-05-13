// Типы базы данных Supabase
// После применения миграции: npx supabase gen types typescript --project-id YOUR_ID > src/lib/supabase/database.types.ts

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; email: string; role: string; name: string; created_at: string }
        Insert: { id: string; email: string; role?: string; name: string }
        Update: { email?: string; role?: string; name?: string }
      }
      clients: {
        Row: {
          id: string; code: string; dikidi_id: string | null; name: string
          phone: string | null; email: string | null; birthday: string | null
          source: string | null; notes: string | null; is_active: boolean
          last_visit_date: string | null; total_revenue: number | null
          visits_count: number | null; created_at: string; updated_at: string
        }
        Insert: {
          id?: string; code?: string; dikidi_id?: string | null; name: string
          phone?: string | null; email?: string | null; birthday?: string | null
          source?: string | null; notes?: string | null; is_active?: boolean
        }
        Update: {
          dikidi_id?: string | null; name?: string; phone?: string | null
          email?: string | null; birthday?: string | null; source?: string | null
          notes?: string | null; is_active?: boolean; last_visit_date?: string | null
          total_revenue?: number | null; visits_count?: number | null
        }
      }
      leads: {
        Row: {
          id: string; client_id: string | null; status_id: string; client_name: string
          phone: string | null; source: string | null; amount: number | null
          notes: string | null; staff_id: string | null; next_contact_at: string | null
          created_at: string; updated_at: string
        }
        Insert: {
          id?: string; client_id?: string | null; status_id: string; client_name: string
          phone?: string | null; source?: string | null; amount?: number | null
          notes?: string | null; staff_id?: string | null; next_contact_at?: string | null
        }
        Update: {
          client_id?: string | null; status_id?: string; client_name?: string
          phone?: string | null; source?: string | null; amount?: number | null
          notes?: string | null; staff_id?: string | null; next_contact_at?: string | null
        }
      }
      lead_statuses: {
        Row: { id: string; name: string; color: string; sort_order: number; is_final: boolean; is_active: boolean }
        Insert: { id?: string; name: string; color?: string; sort_order?: number; is_final?: boolean; is_active?: boolean }
        Update: { name?: string; color?: string; sort_order?: number; is_final?: boolean; is_active?: boolean }
      }
      lead_history: {
        Row: { id: string; lead_id: string; action: string; new_status_id: string | null; note: string | null; created_at: string }
        Insert: { id?: string; lead_id: string; action: string; new_status_id?: string | null; note?: string | null }
        Update: Record<string, never>
      }
      tasks: {
        Row: {
          id: string; lead_id: string | null; client_id: string | null; title: string
          due_date: string | null; is_done: boolean; created_at: string
        }
        Insert: {
          id?: string; lead_id?: string | null; client_id?: string | null; title: string
          due_date?: string | null; is_done?: boolean
        }
        Update: { title?: string; due_date?: string | null; is_done?: boolean }
      }
      staff: {
        Row: {
          id: string; name: string; role: string; rate_percent: number
          salary_base_per_shift: number | null; tax_rate: number; is_active: boolean
          start_date: string; dikidi_id: string | null; created_at: string
        }
        Insert: {
          id?: string; name: string; role: string; rate_percent?: number
          salary_base_per_shift?: number | null; tax_rate?: number; is_active?: boolean
          start_date?: string; dikidi_id?: string | null
        }
        Update: {
          name?: string; role?: string; rate_percent?: number
          salary_base_per_shift?: number | null; tax_rate?: number
          is_active?: boolean; dikidi_id?: string | null
        }
      }
      staff_schedules: {
        Row: { id: string; staff_id: string; date: string; is_worked: boolean; plan_amount: number | null; fact_amount: number | null; bonus: number | null }
        Insert: { id?: string; staff_id: string; date: string; is_worked?: boolean; plan_amount?: number | null; bonus?: number | null }
        Update: { is_worked?: boolean; plan_amount?: number | null; fact_amount?: number | null; bonus?: number | null }
      }
      visits: {
        Row: {
          id: string; dikidi_id: string | null; client_id: string; staff_id: string | null
          visit_date: string; service_name: string; amount: number; prepaid: number
          status: string | null; notes: string | null; created_at: string
        }
        Insert: {
          id?: string; dikidi_id?: string | null; client_id: string; staff_id?: string | null
          visit_date: string; service_name: string; amount?: number; prepaid?: number
          status?: string | null; notes?: string | null
        }
        Update: {
          dikidi_id?: string | null; staff_id?: string | null; visit_date?: string
          service_name?: string; amount?: number; prepaid?: number; status?: string | null; notes?: string | null
        }
      }
      services: {
        Row: { id: string; name: string; direction: string; duration_min: number; price: number; is_active: boolean }
        Insert: { id?: string; name: string; direction: string; duration_min?: number; price: number; is_active?: boolean }
        Update: { name?: string; direction?: string; duration_min?: number; price?: number; is_active?: boolean }
      }
      supply_items: {
        Row: { id: string; name: string; unit: string; last_price: number | null; is_active: boolean }
        Insert: { id?: string; name: string; unit?: string; last_price?: number | null; is_active?: boolean }
        Update: { name?: string; unit?: string; last_price?: number | null; is_active?: boolean }
      }
      procedure_cards: {
        Row: { id: string; service_id: string | null; name: string; duration_min: number; cost_calculated: number | null; is_active: boolean }
        Insert: { id?: string; service_id?: string | null; name: string; duration_min?: number; cost_calculated?: number | null; is_active?: boolean }
        Update: { service_id?: string | null; name?: string; duration_min?: number; cost_calculated?: number | null; is_active?: boolean }
      }
      procedure_card_items: {
        Row: { id: string; procedure_card_id: string; supply_item_id: string; quantity: number; unit: string }
        Insert: { id?: string; procedure_card_id: string; supply_item_id: string; quantity: number; unit: string }
        Update: { quantity?: number; unit?: string }
      }
      expense_categories: {
        Row: { id: string; name: string; cfs_section: string; pnl_section: string; direction: string | null; is_active: boolean }
        Insert: { id?: string; name: string; cfs_section?: string; pnl_section?: string; direction?: string | null; is_active?: boolean }
        Update: { name?: string; cfs_section?: string; pnl_section?: string; direction?: string | null; is_active?: boolean }
      }
      expenses: {
        Row: {
          id: string; date: string; category_id: string; supply_item_id: string | null
          description: string | null; quantity: number | null; unit_price: number | null
          amount: number; account_id: string | null; created_at: string
        }
        Insert: {
          id?: string; date: string; category_id: string; supply_item_id?: string | null
          description?: string | null; quantity?: number | null; unit_price?: number | null
          amount: number; account_id?: string | null
        }
        Update: {
          date?: string; category_id?: string; supply_item_id?: string | null
          description?: string | null; quantity?: number | null; unit_price?: number | null
          amount?: number; account_id?: string | null
        }
      }
      marketing_expenses: {
        Row: { id: string; date: string; source: string | null; amount: number; description: string | null; created_at: string }
        Insert: { id?: string; date: string; source?: string | null; amount: number; description?: string | null }
        Update: { date?: string; source?: string | null; amount?: number; description?: string | null }
      }
      daily_reports: {
        Row: {
          id: string; date: string; revenue_cash: number; revenue_card: number; revenue_online: number
          clients_count: number; new_clients_count: number; avg_check: number
          monthly_plan: number; expenses_cash: number; notes: string | null
          checklist: Record<string, boolean> | null; created_at: string
        }
        Insert: {
          id?: string; date: string; revenue_cash?: number; revenue_card?: number; revenue_online?: number
          clients_count?: number; new_clients_count?: number; avg_check?: number
          monthly_plan?: number; expenses_cash?: number; notes?: string | null
          checklist?: Record<string, boolean> | null
        }
        Update: {
          revenue_cash?: number; revenue_card?: number; revenue_online?: number
          clients_count?: number; new_clients_count?: number; avg_check?: number
          monthly_plan?: number; expenses_cash?: number; notes?: string | null
          checklist?: Record<string, boolean> | null
        }
      }
      accounts: {
        Row: { id: string; name: string; type: string; balance: number; sort_order: number }
        Insert: { id?: string; name: string; type: string; balance?: number; sort_order?: number }
        Update: { name?: string; type?: string; balance?: number; sort_order?: number }
      }
      marketing_channels: {
        Row: { id: string; name: string; is_active: boolean; sort_order: number }
        Insert: { id?: string; name: string; is_active?: boolean; sort_order?: number }
        Update: { name?: string; is_active?: boolean; sort_order?: number }
      }
      client_consents: {
        Row: { id: string; client_id: string; type: string; signed_at: string; valid_until: string | null }
        Insert: { id?: string; client_id: string; type: string; signed_at?: string; valid_until?: string | null }
        Update: { type?: string; signed_at?: string; valid_until?: string | null }
      }
      settings: {
        Row: { id: string; key: string; value: string; updated_at: string }
        Insert: { id?: string; key: string; value: string }
        Update: { value?: string }
      }
      dikidi_sync_log: {
        Row: { id: string; synced_at: string; clients_synced: number; visits_synced: number; status: string; error_message: string | null }
        Insert: { id?: string; clients_synced?: number; visits_synced?: number; status?: string; error_message?: string | null }
        Update: Record<string, never>
      }
      salary_calc: {
        Row: { id: string; staff_id: string; period_start: string; period_end: string; gross_salary: number; tax: number; net_salary: number; created_at: string }
        Insert: { id?: string; staff_id: string; period_start: string; period_end: string; gross_salary: number; tax: number; net_salary: number }
        Update: Record<string, never>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
