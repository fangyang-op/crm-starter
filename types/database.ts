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
          status: string
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
          status?: string
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
          status?: string
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
      application_scholarships: {
        Row: {
          amount_twd: number | null
          application_id: string
          award_letter_path: string | null
          created_at: string
          created_by: string | null
          has_scholarship: boolean
          id: string
          notes: string | null
          scholarship_name: string | null
          updated_at: string
        }
        Insert: {
          amount_twd?: number | null
          application_id: string
          award_letter_path?: string | null
          created_at?: string
          created_by?: string | null
          has_scholarship?: boolean
          id?: string
          notes?: string | null
          scholarship_name?: string | null
          updated_at?: string
        }
        Update: {
          amount_twd?: number | null
          application_id?: string
          award_letter_path?: string | null
          created_at?: string
          created_by?: string | null
          has_scholarship?: boolean
          id?: string
          notes?: string | null
          scholarship_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'application_scholarships_application_id_fkey'
            columns: ['application_id']
            isOneToOne: false
            referencedRelation: 'applications'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'application_scholarships_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
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
          offer_letter_path: string | null
          portal_notes: string | null
          portal_password_encrypted: string | null
          portal_url: string | null
          portal_username: string | null
          program_id: string | null
          program_name_override: string | null
          rejection_letter_path: string | null
          school_id: string
          source_school_list_item_id: string | null
          status: Database['public']['Enums']['application_status']
          student_id: string
          submitted_at: string | null
          tuition_amount: number | null
          tuition_currency: string
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
          offer_letter_path?: string | null
          portal_notes?: string | null
          portal_password_encrypted?: string | null
          portal_url?: string | null
          portal_username?: string | null
          program_id?: string | null
          program_name_override?: string | null
          rejection_letter_path?: string | null
          school_id: string
          source_school_list_item_id?: string | null
          status?: Database['public']['Enums']['application_status']
          student_id: string
          submitted_at?: string | null
          tuition_amount?: number | null
          tuition_currency?: string
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
          offer_letter_path?: string | null
          portal_notes?: string | null
          portal_password_encrypted?: string | null
          portal_url?: string | null
          portal_username?: string | null
          program_id?: string | null
          program_name_override?: string | null
          rejection_letter_path?: string | null
          school_id?: string
          source_school_list_item_id?: string | null
          status?: Database['public']['Enums']['application_status']
          student_id?: string
          submitted_at?: string | null
          tuition_amount?: number | null
          tuition_currency?: string
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
      document_templates: {
        Row: {
          category: string
          code: string
          created_at: string
          default_required: boolean
          description: string | null
          id: string
          is_active: boolean
          label_zh: string
          notes: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          category: string
          code: string
          created_at?: string
          default_required?: boolean
          description?: string | null
          id?: string
          is_active?: boolean
          label_zh: string
          notes?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          default_required?: boolean
          description?: string | null
          id?: string
          is_active?: boolean
          label_zh?: string
          notes?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
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
      lead_source_referrers: {
        Row: {
          created_at: string
          lead_source_id: string
          referrer_id: string
        }
        Insert: {
          created_at?: string
          lead_source_id: string
          referrer_id: string
        }
        Update: {
          created_at?: string
          lead_source_id?: string
          referrer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'lead_source_referrers_lead_source_id_fkey'
            columns: ['lead_source_id']
            isOneToOne: false
            referencedRelation: 'lead_sources'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lead_source_referrers_referrer_id_fkey'
            columns: ['referrer_id']
            isOneToOne: false
            referencedRelation: 'referrers'
            referencedColumns: ['id']
          },
        ]
      }
      lead_sources: {
        Row: {
          code: string
          created_at: string
          default_referrer_id: string | null
          detail_field: string
          id: string
          is_active: boolean
          label_zh: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          default_referrer_id?: string | null
          detail_field?: string
          id?: string
          is_active?: boolean
          label_zh: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          default_referrer_id?: string | null
          detail_field?: string
          id?: string
          is_active?: boolean
          label_zh?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'lead_sources_default_referrer_id_fkey'
            columns: ['default_referrer_id']
            isOneToOne: false
            referencedRelation: 'referrers'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string | null
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
          created_by?: string | null
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
          created_by?: string | null
          department?: Database['public']['Enums']['department'] | null
          display_name?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: Database['public']['Enums']['user_role']
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      referrers: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          default_split_percent: number | null
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
          default_split_percent?: number | null
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
          default_split_percent?: number | null
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
      student_contacts: {
        Row: {
          created_at: string
          created_by: string
          email: string | null
          id: string
          is_primary_contact: boolean
          line_id: string | null
          name: string
          notes: string | null
          phone: string | null
          relation: string
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          email?: string | null
          id?: string
          is_primary_contact?: boolean
          line_id?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          relation: string
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          email?: string | null
          id?: string
          is_primary_contact?: boolean
          line_id?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          relation?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'student_contacts_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'student_contacts_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'students'
            referencedColumns: ['id']
          },
        ]
      }
      student_credentials: {
        Row: {
          account: string | null
          application_id: string | null
          created_at: string
          created_by: string | null
          credential_type: string
          id: string
          label: string
          notes: string | null
          password_encrypted: string | null
          student_id: string
          updated_at: string
          url: string | null
        }
        Insert: {
          account?: string | null
          application_id?: string | null
          created_at?: string
          created_by?: string | null
          credential_type: string
          id?: string
          label: string
          notes?: string | null
          password_encrypted?: string | null
          student_id: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          account?: string | null
          application_id?: string | null
          created_at?: string
          created_by?: string | null
          credential_type?: string
          id?: string
          label?: string
          notes?: string | null
          password_encrypted?: string | null
          student_id?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'student_credentials_application_id_fkey'
            columns: ['application_id']
            isOneToOne: false
            referencedRelation: 'applications'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'student_credentials_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'student_credentials_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'students'
            referencedColumns: ['id']
          },
        ]
      }
      student_defers: {
        Row: {
          agreement_file_path: string
          created_at: string
          created_by: string | null
          id: string
          new_enrollment_date: string
          original_enrollment_date: string | null
          reason: string | null
          student_id: string
        }
        Insert: {
          agreement_file_path: string
          created_at?: string
          created_by?: string | null
          id?: string
          new_enrollment_date: string
          original_enrollment_date?: string | null
          reason?: string | null
          student_id: string
        }
        Update: {
          agreement_file_path?: string
          created_at?: string
          created_by?: string | null
          id?: string
          new_enrollment_date?: string
          original_enrollment_date?: string | null
          reason?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'student_defers_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'student_defers_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'students'
            referencedColumns: ['id']
          },
        ]
      }
      student_required_documents: {
        Row: {
          created_at: string
          document_template_id: string
          file_path: string | null
          id: string
          is_required: boolean
          notes: string | null
          status: string
          student_id: string
          updated_at: string
          uploaded_at: string | null
          uploaded_by: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          document_template_id: string
          file_path?: string | null
          id?: string
          is_required?: boolean
          notes?: string | null
          status?: string
          student_id: string
          updated_at?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          document_template_id?: string
          file_path?: string | null
          id?: string
          is_required?: boolean
          notes?: string | null
          status?: string
          student_id?: string
          updated_at?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'student_required_documents_document_template_id_fkey'
            columns: ['document_template_id']
            isOneToOne: false
            referencedRelation: 'document_templates'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'student_required_documents_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'students'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'student_required_documents_uploaded_by_fkey'
            columns: ['uploaded_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'student_required_documents_verified_by_fkey'
            columns: ['verified_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      student_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_status_id: string | null
          id: string
          note: string | null
          student_id: string
          to_status_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_status_id?: string | null
          id?: string
          note?: string | null
          student_id: string
          to_status_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_status_id?: string | null
          id?: string
          note?: string | null
          student_id?: string
          to_status_id?: string
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
            foreignKeyName: 'student_status_history_from_status_id_fkey'
            columns: ['from_status_id']
            isOneToOne: false
            referencedRelation: 'student_statuses'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'student_status_history_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'students'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'student_status_history_to_status_id_fkey'
            columns: ['to_status_id']
            isOneToOne: false
            referencedRelation: 'student_statuses'
            referencedColumns: ['id']
          },
        ]
      }
      student_statuses: {
        Row: {
          category: string
          code: string
          color_key: string
          created_at: string
          id: string
          is_active: boolean
          label_zh: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category: string
          code: string
          color_key?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label_zh: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string
          code?: string
          color_key?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label_zh?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
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
          lead_source_id: string
          lead_source_note: string | null
          lead_source_referrer_id: string | null
          lead_source_user_id: string | null
          line_id: string | null
          notes: string | null
          phone: string | null
          status_id: string
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
          lead_source_id: string
          lead_source_note?: string | null
          lead_source_referrer_id?: string | null
          lead_source_user_id?: string | null
          line_id?: string | null
          notes?: string | null
          phone?: string | null
          status_id: string
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
          lead_source_id?: string
          lead_source_note?: string | null
          lead_source_referrer_id?: string | null
          lead_source_user_id?: string | null
          line_id?: string | null
          notes?: string | null
          phone?: string | null
          status_id?: string
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
            foreignKeyName: 'students_lead_source_id_fkey'
            columns: ['lead_source_id']
            isOneToOne: false
            referencedRelation: 'lead_sources'
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
          {
            foreignKeyName: 'students_status_id_fkey'
            columns: ['status_id']
            isOneToOne: false
            referencedRelation: 'student_statuses'
            referencedColumns: ['id']
          },
        ]
      }
      uat_chapters: {
        Row: {
          created_at: string
          description: string
          icon: string
          id: string
          is_active: boolean
          sort_order: number
          target_roles: string[]
          title_zh: string
        }
        Insert: {
          created_at?: string
          description: string
          icon: string
          id?: string
          is_active?: boolean
          sort_order?: number
          target_roles?: string[]
          title_zh: string
        }
        Update: {
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          target_roles?: string[]
          title_zh?: string
        }
        Relationships: []
      }
      uat_items: {
        Row: {
          chapter_id: string
          created_at: string
          expected_result: string
          id: string
          is_active: boolean
          item_code: string
          sort_order: number
          step_description: string
        }
        Insert: {
          chapter_id: string
          created_at?: string
          expected_result: string
          id?: string
          is_active?: boolean
          item_code: string
          sort_order?: number
          step_description: string
        }
        Update: {
          chapter_id?: string
          created_at?: string
          expected_result?: string
          id?: string
          is_active?: boolean
          item_code?: string
          sort_order?: number
          step_description?: string
        }
        Relationships: [
          {
            foreignKeyName: 'uat_items_chapter_id_fkey'
            columns: ['chapter_id']
            isOneToOne: false
            referencedRelation: 'uat_chapters'
            referencedColumns: ['id']
          },
        ]
      }
      uat_results: {
        Row: {
          id: string
          item_id: string
          note: string | null
          result: string
          screenshot_path: string | null
          submitted_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          item_id: string
          note?: string | null
          result: string
          screenshot_path?: string | null
          submitted_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          item_id?: string
          note?: string | null
          result?: string
          screenshot_path?: string | null
          submitted_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'uat_results_item_id_fkey'
            columns: ['item_id']
            isOneToOne: false
            referencedRelation: 'uat_items'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'uat_results_user_id_fkey'
            columns: ['user_id']
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
      _admin_user_authorize: { Args: never; Returns: undefined }
      _app_authorize: { Args: { p_student_id: string }; Returns: undefined }
      _commission_authorize: { Args: never; Returns: undefined }
      _dm_authorize: { Args: { p_student_id: string }; Returns: undefined }
      _lead_source_authorize: { Args: never; Returns: undefined }
      _score_authorize: { Args: { p_student_id: string }; Returns: undefined }
      _score_authorize_edit: {
        Args: { p_student_id: string }
        Returns: undefined
      }
      _sl_authorize: { Args: { p_student_id: string }; Returns: undefined }
      _srd_authorize: { Args: { p_student_id: string }; Returns: undefined }
      _student_credentials_authorize: {
        Args: { p_student_id: string }
        Returns: undefined
      }
      _student_status_authorize: { Args: never; Returns: undefined }
      add_school_list_item: {
        Args: {
          p_list_id: string
          p_notes: string
          p_program_id: string
          p_program_name_override: string
          p_school_id: string
          p_tier: string
        }
        Returns: string
      }
      add_word_quota_bonus: {
        Args: { p_amount: number; p_description: string; p_student_id: string }
        Returns: string
      }
      admin_create_user_profile: {
        Args: {
          p_department: string
          p_display_name: string
          p_email: string
          p_full_name: string
          p_role: string
          p_user_id: string
        }
        Returns: undefined
      }
      admin_set_user_active: {
        Args: { p_is_active: boolean; p_user_id: string }
        Returns: undefined
      }
      admin_update_user_profile: {
        Args: {
          p_department: string
          p_display_name: string
          p_full_name: string
          p_role: string
          p_user_id: string
        }
        Returns: undefined
      }
      change_student_status: {
        Args: { p_id: string; p_new_status_id: string; p_note?: string }
        Returns: undefined
      }
      create_academic_score: {
        Args: {
          p_certificate_storage_path: string
          p_expiry_date: string
          p_is_official: boolean
          p_notes: string
          p_score_type: string
          p_student_id: string
          p_sub_scores: Json
          p_test_date: string
          p_total_score: string
        }
        Returns: string
      }
      create_deal: {
        Args: {
          p_contract_no: string
          p_discount_amount: number
          p_discount_reason: string
          p_extra_school_count: number
          p_extra_word_quota: number
          p_notes: string
          p_payment_status: string
          p_plan_id: string
          p_signed_at: string
          p_splits: Json
          p_student_id: string
        }
        Returns: string
      }
      create_documents_master: {
        Args: {
          p_description: string
          p_doc_type: string
          p_student_id: string
          p_title: string
        }
        Returns: string
      }
      create_documents_master_version: {
        Args: {
          p_change_note: string
          p_content: string
          p_master_id: string
          p_word_count: number
          p_word_diff_from_previous: number
        }
        Returns: string
      }
      create_documents_variant_version: {
        Args: {
          p_change_note: string
          p_content: string
          p_variant_id: string
          p_word_count: number
          p_word_diff_from_previous: number
        }
        Returns: string
      }
      create_lead_source:
        | {
            Args: {
              p_code: string
              p_default_referrer_id: string
              p_label_zh: string
              p_sort_order: number
            }
            Returns: string
          }
        | {
            Args: {
              p_code: string
              p_default_referrer_id: string
              p_detail_field: string
              p_label_zh: string
              p_sort_order: number
            }
            Returns: string
          }
      create_preliminary_score: {
        Args: {
          p_score_type: string
          p_student_id: string
          p_sub_scores: Json
          p_total_score: string
        }
        Returns: string
      }
      create_referrer:
        | {
            Args: {
              p_contact_email?: string
              p_contact_phone?: string
              p_name: string
              p_notes?: string
              p_type: string
            }
            Returns: string
          }
        | {
            Args: {
              p_contact_email: string
              p_contact_phone: string
              p_default_split_percent: number
              p_name: string
              p_notes: string
              p_type: string
            }
            Returns: string
          }
      create_school: {
        Args: {
          p_city: string
          p_country: string
          p_is_active: boolean
          p_is_partner: boolean
          p_name_en: string
          p_name_zh: string
          p_partner_commission_rate: number
          p_partner_notes: string
          p_ranking_qs: number
          p_ranking_us_news: number
          p_short_name: string
          p_state_or_region: string
          p_website: string
        }
        Returns: string
      }
      create_school_list: {
        Args: {
          p_copy_from_list_id?: string
          p_name: string
          p_student_id: string
        }
        Returns: string
      }
      create_school_program: {
        Args: {
          p_application_deadline_round1: string
          p_application_deadline_round2: string
          p_degree_level: string
          p_major_category: string
          p_notes: string
          p_program_name: string
          p_school_id: string
        }
        Returns: string
      }
      create_service_plan: {
        Args: {
          p_base_price: number
          p_code: string
          p_currency: string
          p_description: string
          p_display_order: number
          p_included_school_count: number
          p_included_word_quota: number
          p_is_active: boolean
          p_name: string
          p_scope_country: string[]
          p_scope_degree: string[]
        }
        Returns: string
      }
      create_student_credential: {
        Args: {
          p_account: string
          p_credential_type: string
          p_label: string
          p_notes: string
          p_password_encrypted: string
          p_student_id: string
          p_url: string
        }
        Returns: string
      }
      create_student_defer: {
        Args: {
          p_agreement_file_path: string
          p_new_enrollment_date: string
          p_original_enrollment_date: string
          p_reason: string
          p_student_id: string
        }
        Returns: string
      }
      create_student_status: {
        Args: {
          p_category: string
          p_code: string
          p_color_key: string
          p_label_zh: string
          p_sort_order: number
        }
        Returns: string
      }
      current_user_role: {
        Args: never
        Returns: Database['public']['Enums']['user_role']
      }
      delete_academic_score: { Args: { p_id: string }; Returns: string }
      delete_student_credential: { Args: { p_id: string }; Returns: undefined }
      expand_school_list_to_applications: {
        Args: { p_list_id: string }
        Returns: Json
      }
      find_duplicate_student_by_phone: {
        Args: { p_phone: string }
        Returns: Json
      }
      find_phone_anywhere: { Args: { p_phone: string }; Returns: Json }
      fork_documents_variant: {
        Args: {
          p_application_id: string
          p_master_id: string
          p_source_master_version_id: string
        }
        Returns: string
      }
      is_admin: { Args: never; Returns: boolean }
      is_manager_or_admin: { Args: never; Returns: boolean }
      is_student_consultant: {
        Args: { p_student_id: string }
        Returns: boolean
      }
      lock_school_list: { Args: { p_id: string }; Returns: undefined }
      remove_school_list_item: { Args: { p_id: string }; Returns: undefined }
      set_application_decision_file: {
        Args: { p_application_id: string; p_kind: string; p_path: string }
        Returns: undefined
      }
      set_current_school_list: { Args: { p_id: string }; Returns: undefined }
      set_required_document_file: {
        Args: {
          p_file_path: string
          p_student_id: string
          p_template_id: string
        }
        Returns: string
      }
      set_required_document_status: {
        Args: { p_id: string; p_notes: string; p_status: string }
        Returns: undefined
      }
      soft_delete_student: { Args: { p_id: string }; Returns: undefined }
      toggle_required_document: {
        Args: {
          p_is_required: boolean
          p_student_id: string
          p_template_id: string
        }
        Returns: string
      }
      update_academic_score: {
        Args: {
          p_certificate_storage_path: string
          p_expiry_date: string
          p_id: string
          p_is_official: boolean
          p_notes: string
          p_score_type: string
          p_sub_scores: Json
          p_test_date: string
          p_total_score: string
        }
        Returns: undefined
      }
      update_application_meta: {
        Args: {
          p_application_fee: number
          p_application_fee_paid: boolean
          p_application_round: string
          p_deadline: string
          p_decision_notes: string
          p_id: string
          p_notes: string
        }
        Returns: undefined
      }
      update_application_portal: {
        Args: {
          p_id: string
          p_portal_notes: string
          p_portal_password_encrypted: string
          p_portal_url: string
          p_portal_username: string
          p_set_password: boolean
        }
        Returns: undefined
      }
      update_application_status: {
        Args: { p_id: string; p_status: string }
        Returns: undefined
      }
      update_application_tuition: {
        Args: {
          p_application_id: string
          p_tuition_amount: number
          p_tuition_currency: string
        }
        Returns: undefined
      }
      update_commission: {
        Args: {
          p_actual_amount: number
          p_id: string
          p_invoiced_at: string
          p_notes: string
          p_received_at: string
          p_status: string
        }
        Returns: undefined
      }
      update_deal: {
        Args: {
          p_contract_no: string
          p_discount_amount: number
          p_discount_reason: string
          p_extra_school_count: number
          p_extra_word_quota: number
          p_id: string
          p_notes: string
          p_payment_status: string
          p_plan_id: string
          p_signed_at: string
          p_splits: Json
        }
        Returns: undefined
      }
      update_lead_source:
        | {
            Args: {
              p_code: string
              p_default_referrer_id: string
              p_id: string
              p_is_active: boolean
              p_label_zh: string
              p_sort_order: number
            }
            Returns: undefined
          }
        | {
            Args: {
              p_code: string
              p_default_referrer_id: string
              p_detail_field: string
              p_id: string
              p_is_active: boolean
              p_label_zh: string
              p_sort_order: number
            }
            Returns: undefined
          }
      update_referrer:
        | {
            Args: {
              p_contact_email?: string
              p_contact_phone?: string
              p_id: string
              p_is_active?: boolean
              p_name: string
              p_notes?: string
              p_type: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_contact_email: string
              p_contact_phone: string
              p_default_split_percent: number
              p_id: string
              p_is_active: boolean
              p_name: string
              p_notes: string
              p_type: string
            }
            Returns: undefined
          }
      update_school: {
        Args: {
          p_city: string
          p_country: string
          p_id: string
          p_is_active: boolean
          p_is_partner: boolean
          p_name_en: string
          p_name_zh: string
          p_partner_commission_rate: number
          p_partner_notes: string
          p_ranking_qs: number
          p_ranking_us_news: number
          p_short_name: string
          p_state_or_region: string
          p_website: string
        }
        Returns: undefined
      }
      update_school_list_item: {
        Args: {
          p_display_order: number
          p_id: string
          p_notes: string
          p_tier: string
        }
        Returns: undefined
      }
      update_school_program: {
        Args: {
          p_application_deadline_round1: string
          p_application_deadline_round2: string
          p_degree_level: string
          p_id: string
          p_major_category: string
          p_notes: string
          p_program_name: string
        }
        Returns: undefined
      }
      update_service_plan: {
        Args: {
          p_base_price: number
          p_code: string
          p_currency: string
          p_description: string
          p_display_order: number
          p_id: string
          p_included_school_count: number
          p_included_word_quota: number
          p_is_active: boolean
          p_name: string
          p_scope_country: string[]
          p_scope_degree: string[]
        }
        Returns: undefined
      }
      update_student: {
        Args: { p_data: Json; p_id: string }
        Returns: undefined
      }
      update_student_credential: {
        Args: {
          p_account: string
          p_id: string
          p_label: string
          p_notes: string
          p_password_encrypted: string
          p_set_password: boolean
          p_url: string
        }
        Returns: undefined
      }
      update_student_status: {
        Args: {
          p_category: string
          p_code: string
          p_color_key: string
          p_id: string
          p_is_active: boolean
          p_label_zh: string
          p_sort_order: number
        }
        Returns: undefined
      }
      upsert_application_scholarship: {
        Args: {
          p_amount_twd: number
          p_application_id: string
          p_award_letter_path: string
          p_has_scholarship: boolean
          p_notes: string
          p_scholarship_name: string
        }
        Returns: string
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
      department: 'frontend' | 'backend' | 'operations'
      document_type: 'cv' | 'sop' | 'lor' | 'transcript' | 'other'
      score_type: 'gpa' | 'toefl' | 'ielts' | 'gre' | 'gmat' | 'sat' | 'duolingo' | 'other'
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
      department: ['frontend', 'backend', 'operations'],
      document_type: ['cv', 'sop', 'lor', 'transcript', 'other'],
      score_type: ['gpa', 'toefl', 'ielts', 'gre', 'gmat', 'sat', 'duolingo', 'other'],
      user_role: ['consultant', 'manager_frontend', 'manager_backend', 'admin'],
      word_quota_transaction_type: ['initial', 'addon', 'bonus', 'used', 'refund', 'adjustment'],
    },
  },
} as const
