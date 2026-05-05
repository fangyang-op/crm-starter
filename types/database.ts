export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
      academic_scores: {
        Row: {
          certificate_storage_path: string | null
          created_at: string
          created_by: string | null
          expiry_date: string | null
          id: string
          is_official: boolean
          notes: string | null
          score_type: Database['public']['Enums']['score_type']
          student_id: string
          sub_scores: Json | null
          test_date: string | null
          total_score: string | null
        }
        Insert: {
          certificate_storage_path?: string | null
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          is_official?: boolean
          notes?: string | null
          score_type: Database['public']['Enums']['score_type']
          student_id: string
          sub_scores?: Json | null
          test_date?: string | null
          total_score?: string | null
        }
        Update: {
          certificate_storage_path?: string | null
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          is_official?: boolean
          notes?: string | null
          score_type?: Database['public']['Enums']['score_type']
          student_id?: string
          sub_scores?: Json | null
          test_date?: string | null
          total_score?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'academic_scores_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'academic_scores_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'students'
            referencedColumns: ['id']
          },
        ]
      }
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          description: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          payload: Json | null
          student_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          payload?: Json | null
          student_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          payload?: Json | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'activity_log_actor_id_fkey'
            columns: ['actor_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'activity_log_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'students'
            referencedColumns: ['id']
          },
        ]
      }
      addon_pricing: {
        Row: {
          created_at: string
          currency: string
          id: string
          is_active: boolean
          name: string
          type: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          name: string
          type: string
          unit_price: number
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          name?: string
          type?: string
          unit_price?: number
        }
        Relationships: []
      }
      applications: {
        Row: {
          application_fee: number | null
          application_fee_paid: boolean | null
          application_round: string | null
          created_at: string
          deadline: string | null
          decision_at: string | null
          decision_notes: string | null
          id: string
          notes: string | null
          portal_notes: string | null
          portal_password_encrypted: string | null
          portal_url: string | null
          portal_username: string | null
          program_id: string | null
          program_name_override: string | null
          school_id: string
          source_school_list_item_id: string | null
          status: Database['public']['Enums']['application_status']
          student_id: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          application_fee?: number | null
          application_fee_paid?: boolean | null
          application_round?: string | null
          created_at?: string
          deadline?: string | null
          decision_at?: string | null
          decision_notes?: string | null
          id?: string
          notes?: string | null
          portal_notes?: string | null
          portal_password_encrypted?: string | null
          portal_url?: string | null
          portal_username?: string | null
          program_id?: string | null
          program_name_override?: string | null
          school_id: string
          source_school_list_item_id?: string | null
          status?: Database['public']['Enums']['application_status']
          student_id: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          application_fee?: number | null
          application_fee_paid?: boolean | null
          application_round?: string | null
          created_at?: string
          deadline?: string | null
          decision_at?: string | null
          decision_notes?: string | null
          id?: string
          notes?: string | null
          portal_notes?: string | null
          portal_password_encrypted?: string | null
          portal_url?: string | null
          portal_username?: string | null
          program_id?: string | null
          program_name_override?: string | null
          school_id?: string
          source_school_list_item_id?: string | null
          status?: Database['public']['Enums']['application_status']
          student_id?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'applications_program_id_fkey'
            columns: ['program_id']
            isOneToOne: false
            referencedRelation: 'school_programs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'applications_school_id_fkey'
            columns: ['school_id']
            isOneToOne: false
            referencedRelation: 'schools'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'applications_source_school_list_item_id_fkey'
            columns: ['source_school_list_item_id']
            isOneToOne: false
            referencedRelation: 'school_list_items'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'applications_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'students'
            referencedColumns: ['id']
          },
        ]
      }
      commission_records: {
        Row: {
          actual_amount: number | null
          application_id: string
          created_at: string
          currency: string
          expected_amount: number | null
          id: string
          invoiced_at: string | null
          notes: string | null
          received_at: string | null
          school_id: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          actual_amount?: number | null
          application_id: string
          created_at?: string
          currency?: string
          expected_amount?: number | null
          id?: string
          invoiced_at?: string | null
          notes?: string | null
          received_at?: string | null
          school_id: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          actual_amount?: number | null
          application_id?: string
          created_at?: string
          currency?: string
          expected_amount?: number | null
          id?: string
          invoiced_at?: string | null
          notes?: string | null
          received_at?: string | null
          school_id?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'commission_records_application_id_fkey'
            columns: ['application_id']
            isOneToOne: false
            referencedRelation: 'applications'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'commission_records_school_id_fkey'
            columns: ['school_id']
            isOneToOne: false
            referencedRelation: 'schools'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'commission_records_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'students'
            referencedColumns: ['id']
          },
        ]
      }
      consultant_handovers: {
        Row: {
          from_consultant_id: string | null
          handed_at: string
          handover_type: string
          id: string
          initiated_by: string | null
          reason: string | null
          student_id: string
          to_consultant_id: string
        }
        Insert: {
          from_consultant_id?: string | null
          handed_at?: string
          handover_type: string
          id?: string
          initiated_by?: string | null
          reason?: string | null
          student_id: string
          to_consultant_id: string
        }
        Update: {
          from_consultant_id?: string | null
          handed_at?: string
          handover_type?: string
          id?: string
          initiated_by?: string | null
          reason?: string | null
          student_id?: string
          to_consultant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'consultant_handovers_from_consultant_id_fkey'
            columns: ['from_consultant_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'consultant_handovers_initiated_by_fkey'
            columns: ['initiated_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'consultant_handovers_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'students'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'consultant_handovers_to_consultant_id_fkey'
            columns: ['to_consultant_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      deal_commission_splits: {
        Row: {
          amount: number | null
          created_at: string
          deal_id: string
          id: string
          notes: string | null
          percentage: number
          recipient_referrer_id: string | null
          recipient_user_id: string | null
          role_in_deal: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          deal_id: string
          id?: string
          notes?: string | null
          percentage: number
          recipient_referrer_id?: string | null
          recipient_user_id?: string | null
          role_in_deal: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          deal_id?: string
          id?: string
          notes?: string | null
          percentage?: number
          recipient_referrer_id?: string | null
          recipient_user_id?: string | null
          role_in_deal?: string
        }
        Relationships: [
          {
            foreignKeyName: 'deal_commission_splits_deal_id_fkey'
            columns: ['deal_id']
            isOneToOne: false
            referencedRelation: 'deals'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'deal_commission_splits_recipient_referrer_id_fkey'
            columns: ['recipient_referrer_id']
            isOneToOne: false
            referencedRelation: 'referrers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'deal_commission_splits_recipient_user_id_fkey'
            columns: ['recipient_user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      deals: {
        Row: {
          addon_amount: number
          base_amount: number
          contract_no: string | null
          created_at: string
          created_by: string | null
          currency: string
          discount_amount: number
          discount_reason: string | null
          extra_school_count: number
          extra_word_quota: number
          final_amount: number
          id: string
          notes: string | null
          payment_status: string
          plan_id: string
          signed_at: string
          student_id: string
          updated_at: string
        }
        Insert: {
          addon_amount?: number
          base_amount: number
          contract_no?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          discount_amount?: number
          discount_reason?: string | null
          extra_school_count?: number
          extra_word_quota?: number
          final_amount: number
          id?: string
          notes?: string | null
          payment_status?: string
          plan_id: string
          signed_at: string
          student_id: string
          updated_at?: string
        }
        Update: {
          addon_amount?: number
          base_amount?: number
          contract_no?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          discount_amount?: number
          discount_reason?: string | null
          extra_school_count?: number
          extra_word_quota?: number
          final_amount?: number
          id?: string
          notes?: string | null
          payment_status?: string
          plan_id?: string
          signed_at?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'deals_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'deals_plan_id_fkey'
            columns: ['plan_id']
            isOneToOne: false
            referencedRelation: 'service_plans'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'deals_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'students'
            referencedColumns: ['id']
          },
        ]
      }
      documents_master: {
        Row: {
          created_at: string
          created_by: string | null
          current_version_id: string | null
          description: string | null
          doc_type: Database['public']['Enums']['document_type']
          id: string
          is_archived: boolean
          student_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          description?: string | null
          doc_type: Database['public']['Enums']['document_type']
          id?: string
          is_archived?: boolean
          student_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          description?: string | null
          doc_type?: Database['public']['Enums']['document_type']
          id?: string
          is_archived?: boolean
          student_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'documents_master_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'documents_master_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'students'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fk_doc_master_current_version'
            columns: ['current_version_id']
            isOneToOne: false
            referencedRelation: 'documents_master_versions'
            referencedColumns: ['id']
          },
        ]
      }
      documents_master_versions: {
        Row: {
          change_note: string | null
          content: string | null
          created_at: string
          id: string
          master_id: string
          modified_by: string | null
          storage_path: string | null
          version_number: number
          word_count: number
          word_diff_from_previous: number
        }
        Insert: {
          change_note?: string | null
          content?: string | null
          created_at?: string
          id?: string
          master_id: string
          modified_by?: string | null
          storage_path?: string | null
          version_number: number
          word_count?: number
          word_diff_from_previous?: number
        }
        Update: {
          change_note?: string | null
          content?: string | null
          created_at?: string
          id?: string
          master_id?: string
          modified_by?: string | null
          storage_path?: string | null
          version_number?: number
          word_count?: number
          word_diff_from_previous?: number
        }
        Relationships: [
          {
            foreignKeyName: 'documents_master_versions_master_id_fkey'
            columns: ['master_id']
            isOneToOne: false
            referencedRelation: 'documents_master'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'documents_master_versions_modified_by_fkey'
            columns: ['modified_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      documents_variant_versions: {
        Row: {
          change_note: string | null
          content: string | null
          created_at: string
          id: string
          modified_by: string | null
          storage_path: string | null
          variant_id: string
          version_number: number
          word_count: number
          word_diff_from_previous: number
        }
        Insert: {
          change_note?: string | null
          content?: string | null
          created_at?: string
          id?: string
          modified_by?: string | null
          storage_path?: string | null
          variant_id: string
          version_number: number
          word_count?: number
          word_diff_from_previous?: number
        }
        Update: {
          change_note?: string | null
          content?: string | null
          created_at?: string
          id?: string
          modified_by?: string | null
          storage_path?: string | null
          variant_id?: string
          version_number?: number
          word_count?: number
          word_diff_from_previous?: number
        }
        Relationships: [
          {
            foreignKeyName: 'documents_variant_versions_modified_by_fkey'
            columns: ['modified_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'documents_variant_versions_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'documents_variants'
            referencedColumns: ['id']
          },
        ]
      }
      documents_variants: {
        Row: {
          application_id: string
          created_at: string
          created_by: string | null
          current_version_id: string | null
          forked_from_master_version_id: string | null
          id: string
          is_finalized: boolean
          master_id: string
          updated_at: string
        }
        Insert: {
          application_id: string
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          forked_from_master_version_id?: string | null
          id?: string
          is_finalized?: boolean
          master_id: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          forked_from_master_version_id?: string | null
          id?: string
          is_finalized?: boolean
          master_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'documents_variants_application_id_fkey'
            columns: ['application_id']
            isOneToOne: false
            referencedRelation: 'applications'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'documents_variants_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'documents_variants_forked_from_master_version_id_fkey'
            columns: ['forked_from_master_version_id']
            isOneToOne: false
            referencedRelation: 'documents_master_versions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'documents_variants_master_id_fkey'
            columns: ['master_id']
            isOneToOne: false
            referencedRelation: 'documents_master'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fk_doc_variant_current_version'
            columns: ['current_version_id']
            isOneToOne: false
            referencedRelation: 'documents_variant_versions'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          department: Database['public']['Enums']['department'] | null
          display_name: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          role: Database['public']['Enums']['user_role']
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department?: Database['public']['Enums']['department'] | null
          display_name?: string | null
          email: string
          full_name: string
          id: string
          is_active?: boolean
          role?: Database['public']['Enums']['user_role']
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department?: Database['public']['Enums']['department'] | null
          display_name?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: Database['public']['Enums']['user_role']
          updated_at?: string
        }
        Relationships: []
      }
      referrers: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          type: string
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      school_list_items: {
        Row: {
          created_at: string
          display_order: number
          id: string
          notes: string | null
          program_id: string | null
          program_name_override: string | null
          school_id: string
          school_list_id: string
          tier: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          notes?: string | null
          program_id?: string | null
          program_name_override?: string | null
          school_id: string
          school_list_id: string
          tier: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          notes?: string | null
          program_id?: string | null
          program_name_override?: string | null
          school_id?: string
          school_list_id?: string
          tier?: string
        }
        Relationships: [
          {
            foreignKeyName: 'school_list_items_program_id_fkey'
            columns: ['program_id']
            isOneToOne: false
            referencedRelation: 'school_programs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'school_list_items_school_id_fkey'
            columns: ['school_id']
            isOneToOne: false
            referencedRelation: 'schools'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'school_list_items_school_list_id_fkey'
            columns: ['school_list_id']
            isOneToOne: false
            referencedRelation: 'school_lists'
            referencedColumns: ['id']
          },
        ]
      }
      school_lists: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_current: boolean
          is_locked: boolean
          name: string
          notes: string | null
          student_id: string
          updated_at: string
          version_number: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_current?: boolean
          is_locked?: boolean
          name: string
          notes?: string | null
          student_id: string
          updated_at?: string
          version_number?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_current?: boolean
          is_locked?: boolean
          name?: string
          notes?: string | null
          student_id?: string
          updated_at?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: 'school_lists_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'school_lists_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'students'
            referencedColumns: ['id']
          },
        ]
      }
      school_programs: {
        Row: {
          application_deadline_round1: string | null
          application_deadline_round2: string | null
          created_at: string
          degree_level: string
          id: string
          major_category: string | null
          notes: string | null
          program_name: string
          school_id: string
        }
        Insert: {
          application_deadline_round1?: string | null
          application_deadline_round2?: string | null
          created_at?: string
          degree_level: string
          id?: string
          major_category?: string | null
          notes?: string | null
          program_name: string
          school_id: string
        }
        Update: {
          application_deadline_round1?: string | null
          application_deadline_round2?: string | null
          created_at?: string
          degree_level?: string
          id?: string
          major_category?: string | null
          notes?: string | null
          program_name?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'school_programs_school_id_fkey'
            columns: ['school_id']
            isOneToOne: false
            referencedRelation: 'schools'
            referencedColumns: ['id']
          },
        ]
      }
      schools: {
        Row: {
          city: string | null
          country: string
          created_at: string
          id: string
          is_active: boolean
          is_partner: boolean
          name_en: string
          name_zh: string | null
          partner_commission_rate: number | null
          partner_notes: string | null
          ranking_qs: number | null
          ranking_us_news: number | null
          short_name: string | null
          state_or_region: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          city?: string | null
          country: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_partner?: boolean
          name_en: string
          name_zh?: string | null
          partner_commission_rate?: number | null
          partner_notes?: string | null
          ranking_qs?: number | null
          ranking_us_news?: number | null
          short_name?: string | null
          state_or_region?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          city?: string | null
          country?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_partner?: boolean
          name_en?: string
          name_zh?: string | null
          partner_commission_rate?: number | null
          partner_notes?: string | null
          ranking_qs?: number | null
          ranking_us_news?: number | null
          short_name?: string | null
          state_or_region?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      service_plans: {
        Row: {
          base_price: number
          code: string
          created_at: string
          currency: string
          description: string | null
          display_order: number
          id: string
          included_school_count: number | null
          included_word_quota: number | null
          is_active: boolean
          name: string
          scope_country: string[] | null
          scope_degree: string[] | null
          updated_at: string
        }
        Insert: {
          base_price: number
          code: string
          created_at?: string
          currency?: string
          description?: string | null
          display_order?: number
          id?: string
          included_school_count?: number | null
          included_word_quota?: number | null
          is_active?: boolean
          name: string
          scope_country?: string[] | null
          scope_degree?: string[] | null
          updated_at?: string
        }
        Update: {
          base_price?: number
          code?: string
          created_at?: string
          currency?: string
          description?: string | null
          display_order?: number
          id?: string
          included_school_count?: number | null
          included_word_quota?: number | null
          is_active?: boolean
          name?: string
          scope_country?: string[] | null
          scope_degree?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      student_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_status: Database['public']['Enums']['student_status'] | null
          id: string
          note: string | null
          student_id: string
          to_status: Database['public']['Enums']['student_status']
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_status?: Database['public']['Enums']['student_status'] | null
          id?: string
          note?: string | null
          student_id: string
          to_status: Database['public']['Enums']['student_status']
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_status?: Database['public']['Enums']['student_status'] | null
          id?: string
          note?: string | null
          student_id?: string
          to_status?: Database['public']['Enums']['student_status']
        }
        Relationships: [
          {
            foreignKeyName: 'student_status_history_changed_by_fkey'
            columns: ['changed_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'student_status_history_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'students'
            referencedColumns: ['id']
          },
        ]
      }
      students: {
        Row: {
          backend_consultant_id: string | null
          birth_date: string | null
          created_at: string
          created_by: string | null
          current_degree: string | null
          current_major: string | null
          current_school: string | null
          deleted_at: string | null
          email: string | null
          english_name: string | null
          frontend_consultant_id: string | null
          full_name: string
          graduation_year: number | null
          id: string
          lead_source_note: string | null
          lead_source_referrer_id: string | null
          lead_source_type: Database['public']['Enums']['lead_source_type']
          lead_source_user_id: string | null
          line_id: string | null
          notes: string | null
          phone: string | null
          status: Database['public']['Enums']['student_status']
          tags: string[] | null
          target_country: string[] | null
          target_degree: string | null
          target_intake: string | null
          target_major: string | null
          updated_at: string
        }
        Insert: {
          backend_consultant_id?: string | null
          birth_date?: string | null
          created_at?: string
          created_by?: string | null
          current_degree?: string | null
          current_major?: string | null
          current_school?: string | null
          deleted_at?: string | null
          email?: string | null
          english_name?: string | null
          frontend_consultant_id?: string | null
          full_name: string
          graduation_year?: number | null
          id?: string
          lead_source_note?: string | null
          lead_source_referrer_id?: string | null
          lead_source_type?: Database['public']['Enums']['lead_source_type']
          lead_source_user_id?: string | null
          line_id?: string | null
          notes?: string | null
          phone?: string | null
          status?: Database['public']['Enums']['student_status']
          tags?: string[] | null
          target_country?: string[] | null
          target_degree?: string | null
          target_intake?: string | null
          target_major?: string | null
          updated_at?: string
        }
        Update: {
          backend_consultant_id?: string | null
          birth_date?: string | null
          created_at?: string
          created_by?: string | null
          current_degree?: string | null
          current_major?: string | null
          current_school?: string | null
          deleted_at?: string | null
          email?: string | null
          english_name?: string | null
          frontend_consultant_id?: string | null
          full_name?: string
          graduation_year?: number | null
          id?: string
          lead_source_note?: string | null
          lead_source_referrer_id?: string | null
          lead_source_type?: Database['public']['Enums']['lead_source_type']
          lead_source_user_id?: string | null
          line_id?: string | null
          notes?: string | null
          phone?: string | null
          status?: Database['public']['Enums']['student_status']
          tags?: string[] | null
          target_country?: string[] | null
          target_degree?: string | null
          target_intake?: string | null
          target_major?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'students_backend_consultant_id_fkey'
            columns: ['backend_consultant_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'students_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'students_frontend_consultant_id_fkey'
            columns: ['frontend_consultant_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'students_lead_source_referrer_id_fkey'
            columns: ['lead_source_referrer_id']
            isOneToOne: false
            referencedRelation: 'referrers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'students_lead_source_user_id_fkey'
            columns: ['lead_source_user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      word_quota_ledger: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          created_by: string | null
          description: string
          id: string
          related_deal_id: string | null
          related_master_version_id: string | null
          related_variant_version_id: string | null
          student_id: string
          transaction_type: Database['public']['Enums']['word_quota_transaction_type']
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          related_deal_id?: string | null
          related_master_version_id?: string | null
          related_variant_version_id?: string | null
          student_id: string
          transaction_type: Database['public']['Enums']['word_quota_transaction_type']
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          related_deal_id?: string | null
          related_master_version_id?: string | null
          related_variant_version_id?: string | null
          student_id?: string
          transaction_type?: Database['public']['Enums']['word_quota_transaction_type']
        }
        Relationships: [
          {
            foreignKeyName: 'word_quota_ledger_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'word_quota_ledger_related_deal_id_fkey'
            columns: ['related_deal_id']
            isOneToOne: false
            referencedRelation: 'deals'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'word_quota_ledger_related_master_version_id_fkey'
            columns: ['related_master_version_id']
            isOneToOne: false
            referencedRelation: 'documents_master_versions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'word_quota_ledger_related_variant_version_id_fkey'
            columns: ['related_variant_version_id']
            isOneToOne: false
            referencedRelation: 'documents_variant_versions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'word_quota_ledger_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'students'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_role: {
        Args: never
        Returns: Database['public']['Enums']['user_role']
      }
      is_admin: { Args: never; Returns: boolean }
      is_manager_or_admin: { Args: never; Returns: boolean }
      is_student_consultant: {
        Args: { p_student_id: string }
        Returns: boolean
      }
    }
    Enums: {
      application_status:
        | 'pending_send'
        | 'submitted'
        | 'docs_required'
        | 'interview'
        | 'admitted'
        | 'rejected'
        | 'waitlisted'
        | 'declined_by_us'
        | 'enrolled'
      department: 'frontend' | 'backend'
      document_type: 'cv' | 'sop' | 'lor' | 'transcript' | 'other'
      lead_source_type:
        | 'self_developed'
        | 'marketing_dept'
        | 'consultant_referral'
        | 'external_referrer'
        | 'brand_introduction'
        | 'other'
      score_type: 'gpa' | 'toefl' | 'ielts' | 'gre' | 'gmat' | 'sat' | 'duolingo' | 'other'
      student_status:
        | 'new_lead'
        | 'contacted'
        | 'consulting'
        | 'qualified'
        | 'disqualified'
        | 'closed_won'
        | 'onboarding'
        | 'school_selection'
        | 'document_prep'
        | 'submitting'
        | 'awaiting_decision'
        | 'decision_making'
        | 'pre_departure'
        | 'enrolled'
        | 'paused'
        | 'terminated'
      user_role: 'consultant' | 'manager_frontend' | 'manager_backend' | 'admin'
      word_quota_transaction_type: 'initial' | 'addon' | 'bonus' | 'used' | 'refund' | 'adjustment'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      application_status: [
        'pending_send',
        'submitted',
        'docs_required',
        'interview',
        'admitted',
        'rejected',
        'waitlisted',
        'declined_by_us',
        'enrolled',
      ],
      department: ['frontend', 'backend'],
      document_type: ['cv', 'sop', 'lor', 'transcript', 'other'],
      lead_source_type: [
        'self_developed',
        'marketing_dept',
        'consultant_referral',
        'external_referrer',
        'brand_introduction',
        'other',
      ],
      score_type: ['gpa', 'toefl', 'ielts', 'gre', 'gmat', 'sat', 'duolingo', 'other'],
      student_status: [
        'new_lead',
        'contacted',
        'consulting',
        'qualified',
        'disqualified',
        'closed_won',
        'onboarding',
        'school_selection',
        'document_prep',
        'submitting',
        'awaiting_decision',
        'decision_making',
        'pre_departure',
        'enrolled',
        'paused',
        'terminated',
      ],
      user_role: ['consultant', 'manager_frontend', 'manager_backend', 'admin'],
      word_quota_transaction_type: ['initial', 'addon', 'bonus', 'used', 'refund', 'adjustment'],
    },
  },
} as const
