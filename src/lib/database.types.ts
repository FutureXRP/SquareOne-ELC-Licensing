// GENERATED FILE. Do not edit by hand. Regenerate with `pnpm db:types`.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      audit_events: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          entity_table: string;
          entity_id: string | null;
          before: Json | null;
          after: Json | null;
          at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          action: string;
          entity_table: string;
          entity_id?: string | null;
          before?: Json | null;
          after?: Json | null;
          at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          action?: string;
          entity_table?: string;
          entity_id?: string | null;
          before?: Json | null;
          after?: Json | null;
          at?: string;
        };
        Relationships: [];
      };
      auditor_grants: {
        Row: {
          id: string;
          profile_id: string;
          label: string;
          scope: Json;
          expires_at: string;
          created_by: string | null;
          revoked_at: string | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          profile_id: string;
          label: string;
          scope?: Json;
          expires_at: string;
          created_by?: string | null;
          revoked_at?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          profile_id?: string;
          label?: string;
          scope?: Json;
          expires_at?: string;
          created_by?: string | null;
          revoked_at?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      authorities: {
        Row: {
          id: string;
          code: Database["public"]["Enums"]["authority_code"];
          name: string;
          website: string | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          code: Database["public"]["Enums"]["authority_code"];
          name: string;
          website?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          code?: Database["public"]["Enums"]["authority_code"];
          name?: string;
          website?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      children: {
        Row: {
          id: string;
          child_code: string;
          first_name: string;
          last_initial: string;
          classroom_id: string | null;
          enrollment_date: string | null;
          status: string;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          child_code: string;
          first_name: string;
          last_initial: string;
          classroom_id?: string | null;
          enrollment_date?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          child_code?: string;
          first_name?: string;
          last_initial?: string;
          classroom_id?: string | null;
          enrollment_date?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      classroom_reviewer_assignments: {
        Row: {
          id: string;
          profile_id: string;
          classroom_id: string;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          profile_id: string;
          classroom_id: string;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          profile_id?: string;
          classroom_id?: string;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      classrooms: {
        Row: {
          id: string;
          program_id: string;
          name: string;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          program_id: string;
          name: string;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          program_id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      corrective_actions: {
        Row: {
          id: string;
          finding_id: string;
          description: string;
          owner_id: string | null;
          due_date: string | null;
          evidence_id: string | null;
          verified_by: string | null;
          verified_at: string | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          finding_id: string;
          description: string;
          owner_id?: string | null;
          due_date?: string | null;
          evidence_id?: string | null;
          verified_by?: string | null;
          verified_at?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          finding_id?: string;
          description?: string;
          owner_id?: string | null;
          due_date?: string | null;
          evidence_id?: string | null;
          verified_by?: string | null;
          verified_at?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      credential_types: {
        Row: {
          id: string;
          name: string;
          category: string | null;
          requires_expiration: boolean;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          category?: string | null;
          requires_expiration?: boolean;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          category?: string | null;
          requires_expiration?: boolean;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      credentials: {
        Row: {
          id: string;
          staff_id: string;
          credential_type_id: string;
          issuer: string | null;
          issue_date: string | null;
          expiration_date: string | null;
          internal_review_date: string | null;
          eligibility_status: string | null;
          evidence_id: string | null;
          reviewer_id: string | null;
          verified_at: string | null;
          renewal_owner_id: string | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          staff_id: string;
          credential_type_id: string;
          issuer?: string | null;
          issue_date?: string | null;
          expiration_date?: string | null;
          internal_review_date?: string | null;
          eligibility_status?: string | null;
          evidence_id?: string | null;
          reviewer_id?: string | null;
          verified_at?: string | null;
          renewal_owner_id?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          staff_id?: string;
          credential_type_id?: string;
          issuer?: string | null;
          issue_date?: string | null;
          expiration_date?: string | null;
          internal_review_date?: string | null;
          eligibility_status?: string | null;
          evidence_id?: string | null;
          reviewer_id?: string | null;
          verified_at?: string | null;
          renewal_owner_id?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      evidence: {
        Row: {
          id: string;
          doc_type: string;
          storage_path: string;
          file_name: string;
          version: number;
          subject_type: Database["public"]["Enums"]["applicability_scope"];
          subject_id: string | null;
          uploader_id: string;
          uploaded_at: string;
          issue_date: string | null;
          expiry_date: string | null;
          access_class: Database["public"]["Enums"]["access_class"];
          supersedes_id: string | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          doc_type: string;
          storage_path: string;
          file_name: string;
          version?: number;
          subject_type: Database["public"]["Enums"]["applicability_scope"];
          subject_id?: string | null;
          uploader_id: string;
          uploaded_at?: string;
          issue_date?: string | null;
          expiry_date?: string | null;
          access_class?: Database["public"]["Enums"]["access_class"];
          supersedes_id?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          doc_type?: string;
          storage_path?: string;
          file_name?: string;
          version?: number;
          subject_type?: Database["public"]["Enums"]["applicability_scope"];
          subject_id?: string | null;
          uploader_id?: string;
          uploaded_at?: string;
          issue_date?: string | null;
          expiry_date?: string | null;
          access_class?: Database["public"]["Enums"]["access_class"];
          supersedes_id?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      evidence_links: {
        Row: {
          id: string;
          evidence_id: string;
          requirement_instance_id: string;
          status: Database["public"]["Enums"]["link_status"];
          reviewer_id: string | null;
          reviewed_at: string | null;
          correction_note: string | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          evidence_id: string;
          requirement_instance_id: string;
          status?: Database["public"]["Enums"]["link_status"];
          reviewer_id?: string | null;
          reviewed_at?: string | null;
          correction_note?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          evidence_id?: string;
          requirement_instance_id?: string;
          status?: Database["public"]["Enums"]["link_status"];
          reviewer_id?: string | null;
          reviewed_at?: string | null;
          correction_note?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      findings: {
        Row: {
          id: string;
          inspection_id: string;
          requirement_id: string | null;
          description: string;
          criticality: Database["public"]["Enums"]["criticality"] | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          inspection_id: string;
          requirement_id?: string | null;
          description: string;
          criticality?: Database["public"]["Enums"]["criticality"] | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          inspection_id?: string;
          requirement_id?: string | null;
          description?: string;
          criticality?: Database["public"]["Enums"]["criticality"] | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      inspections: {
        Row: {
          id: string;
          authority_id: string;
          inspection_date: string;
          inspector: string | null;
          kind: string;
          summary: string | null;
          evidence_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          authority_id: string;
          inspection_date: string;
          inspector?: string | null;
          kind?: string;
          summary?: string | null;
          evidence_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          authority_id?: string;
          inspection_date?: string;
          inspector?: string | null;
          kind?: string;
          summary?: string | null;
          evidence_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      policies: {
        Row: {
          id: string;
          title: string;
          category: string | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          category?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          category?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      policy_acknowledgments: {
        Row: {
          id: string;
          policy_version_id: string;
          profile_id: string;
          acknowledged_at: string;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          policy_version_id: string;
          profile_id: string;
          acknowledged_at?: string;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          policy_version_id?: string;
          profile_id?: string;
          acknowledged_at?: string;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      policy_versions: {
        Row: {
          id: string;
          policy_id: string;
          version_label: string;
          effective_date: string | null;
          summary: string | null;
          evidence_id: string | null;
          status: Database["public"]["Enums"]["lifecycle_status"];
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          policy_id: string;
          version_label: string;
          effective_date?: string | null;
          summary?: string | null;
          evidence_id?: string | null;
          status?: Database["public"]["Enums"]["lifecycle_status"];
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          policy_id?: string;
          version_label?: string;
          effective_date?: string | null;
          summary?: string | null;
          evidence_id?: string | null;
          status?: Database["public"]["Enums"]["lifecycle_status"];
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          staff_id: string | null;
          email: string;
          display_name: string | null;
          is_active: boolean;
          child_health_access: boolean;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id: string;
          role?: Database["public"]["Enums"]["app_role"];
          staff_id?: string | null;
          email: string;
          display_name?: string | null;
          is_active?: boolean;
          child_health_access?: boolean;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          staff_id?: string | null;
          email?: string;
          display_name?: string | null;
          is_active?: boolean;
          child_health_access?: boolean;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      programs: {
        Row: {
          id: string;
          name: string;
          parent_org: string | null;
          jurisdiction: string | null;
          quality_designation: string | null;
          accreditation_name: string | null;
          accreditation_date: string | null;
          licensed_capacity: number | null;
          leadership_theme: string | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          parent_org?: string | null;
          jurisdiction?: string | null;
          quality_designation?: string | null;
          accreditation_name?: string | null;
          accreditation_date?: string | null;
          licensed_capacity?: number | null;
          leadership_theme?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          parent_org?: string | null;
          jurisdiction?: string | null;
          quality_designation?: string | null;
          accreditation_name?: string | null;
          accreditation_date?: string | null;
          licensed_capacity?: number | null;
          leadership_theme?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      reminder_events: {
        Row: {
          id: string;
          requirement_instance_id: string | null;
          task_id: string | null;
          milestone: Database["public"]["Enums"]["reminder_milestone"];
          recipient_id: string;
          channel: string;
          due_date: string | null;
          status: Database["public"]["Enums"]["delivery_status"];
          attempts: number;
          last_error: string | null;
          provider_message_id: string | null;
          sent_at: string | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
          credential_id: string | null;
        };
        Insert: {
          id?: string;
          requirement_instance_id?: string | null;
          task_id?: string | null;
          milestone: Database["public"]["Enums"]["reminder_milestone"];
          recipient_id: string;
          channel?: string;
          due_date?: string | null;
          status?: Database["public"]["Enums"]["delivery_status"];
          attempts?: number;
          last_error?: string | null;
          provider_message_id?: string | null;
          sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
          credential_id?: string | null;
        };
        Update: {
          id?: string;
          requirement_instance_id?: string | null;
          task_id?: string | null;
          milestone?: Database["public"]["Enums"]["reminder_milestone"];
          recipient_id?: string;
          channel?: string;
          due_date?: string | null;
          status?: Database["public"]["Enums"]["delivery_status"];
          attempts?: number;
          last_error?: string | null;
          provider_message_id?: string | null;
          sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
          credential_id?: string | null;
        };
        Relationships: [];
      };
      reporting_periods: {
        Row: {
          id: string;
          label: string;
          start_date: string;
          end_date: string;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          label: string;
          start_date: string;
          end_date: string;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          label?: string;
          start_date?: string;
          end_date?: string;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      requirement_instances: {
        Row: {
          id: string;
          requirement_version_id: string;
          subject_type: Database["public"]["Enums"]["applicability_scope"];
          subject_id: string | null;
          owner_id: string | null;
          backup_id: string | null;
          reviewer_id: string | null;
          due_date: string | null;
          cycle_number: number;
          previous_instance_id: string | null;
          na_reason: string | null;
          na_approved_by: string | null;
          na_approved_at: string | null;
          verified_at: string | null;
          verified_by: string | null;
          closed_at: string | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          requirement_version_id: string;
          subject_type: Database["public"]["Enums"]["applicability_scope"];
          subject_id?: string | null;
          owner_id?: string | null;
          backup_id?: string | null;
          reviewer_id?: string | null;
          due_date?: string | null;
          cycle_number?: number;
          previous_instance_id?: string | null;
          na_reason?: string | null;
          na_approved_by?: string | null;
          na_approved_at?: string | null;
          verified_at?: string | null;
          verified_by?: string | null;
          closed_at?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          requirement_version_id?: string;
          subject_type?: Database["public"]["Enums"]["applicability_scope"];
          subject_id?: string | null;
          owner_id?: string | null;
          backup_id?: string | null;
          reviewer_id?: string | null;
          due_date?: string | null;
          cycle_number?: number;
          previous_instance_id?: string | null;
          na_reason?: string | null;
          na_approved_by?: string | null;
          na_approved_at?: string | null;
          verified_at?: string | null;
          verified_by?: string | null;
          closed_at?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      requirement_versions: {
        Row: {
          id: string;
          requirement_id: string;
          version_label: string;
          effective_date: string | null;
          citation: string | null;
          source_url: string | null;
          scope: Database["public"]["Enums"]["applicability_scope"];
          applies_to: Json;
          description: string | null;
          evidence_criteria: string | null;
          frequency: Database["public"]["Enums"]["frequency_type"] | null;
          recurrence_rule: Json | null;
          criticality: Database["public"]["Enums"]["criticality"] | null;
          last_source_review: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["lifecycle_status"];
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          requirement_id: string;
          version_label: string;
          effective_date?: string | null;
          citation?: string | null;
          source_url?: string | null;
          scope: Database["public"]["Enums"]["applicability_scope"];
          applies_to?: Json;
          description?: string | null;
          evidence_criteria?: string | null;
          frequency?: Database["public"]["Enums"]["frequency_type"] | null;
          recurrence_rule?: Json | null;
          criticality?: Database["public"]["Enums"]["criticality"] | null;
          last_source_review?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["lifecycle_status"];
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          requirement_id?: string;
          version_label?: string;
          effective_date?: string | null;
          citation?: string | null;
          source_url?: string | null;
          scope?: Database["public"]["Enums"]["applicability_scope"];
          applies_to?: Json;
          description?: string | null;
          evidence_criteria?: string | null;
          frequency?: Database["public"]["Enums"]["frequency_type"] | null;
          recurrence_rule?: Json | null;
          criticality?: Database["public"]["Enums"]["criticality"] | null;
          last_source_review?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["lifecycle_status"];
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      requirements: {
        Row: {
          id: string;
          code: string;
          authority_id: string;
          title: string;
          category: string | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          code: string;
          authority_id: string;
          title: string;
          category?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          code?: string;
          authority_id?: string;
          title?: string;
          category?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      review_cycles: {
        Row: {
          id: string;
          quarter: number;
          year: number;
          opened_at: string;
          opened_by: string | null;
          signed_off_by: string | null;
          signed_off_at: string | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          quarter: number;
          year: number;
          opened_at?: string;
          opened_by?: string | null;
          signed_off_by?: string | null;
          signed_off_at?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          quarter?: number;
          year?: number;
          opened_at?: string;
          opened_by?: string | null;
          signed_off_by?: string | null;
          signed_off_at?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      review_results: {
        Row: {
          id: string;
          cycle_id: string;
          scope: string;
          snapshot: Json;
          exceptions: Json;
          follow_up_task_ids: string[];
          created_by: string | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          cycle_id: string;
          scope: string;
          snapshot: Json;
          exceptions?: Json;
          follow_up_task_ids?: string[];
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          cycle_id?: string;
          scope?: string;
          snapshot?: Json;
          exceptions?: Json;
          follow_up_task_ids?: string[];
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      safety_checks: {
        Row: {
          id: string;
          classroom_id: string | null;
          check_type: string;
          performed_on: string;
          performed_by: string;
          result: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          classroom_id?: string | null;
          check_type: string;
          performed_on: string;
          performed_by: string;
          result: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          classroom_id?: string | null;
          check_type?: string;
          performed_on?: string;
          performed_by?: string;
          result?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      settings: {
        Row: {
          id: string;
          key: string;
          value: Json;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          key: string;
          value: Json;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          key?: string;
          value?: Json;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      staff: {
        Row: {
          id: string;
          employee_code: string;
          first_name: string;
          last_name: string;
          employment_status: Database["public"]["Enums"]["employment_status"];
          role_title: string | null;
          classroom_id: string | null;
          hire_date: string | null;
          supervisor_id: string | null;
          requirement_set: string | null;
          separation_date: string | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          employee_code: string;
          first_name: string;
          last_name: string;
          employment_status?: Database["public"]["Enums"]["employment_status"];
          role_title?: string | null;
          classroom_id?: string | null;
          hire_date?: string | null;
          supervisor_id?: string | null;
          requirement_set?: string | null;
          separation_date?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          employee_code?: string;
          first_name?: string;
          last_name?: string;
          employment_status?: Database["public"]["Enums"]["employment_status"];
          role_title?: string | null;
          classroom_id?: string | null;
          hire_date?: string | null;
          supervisor_id?: string | null;
          requirement_set?: string | null;
          separation_date?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          requirement_instance_id: string | null;
          title: string;
          assignee_id: string | null;
          due_date: string | null;
          status: Database["public"]["Enums"]["task_status"];
          kind: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          requirement_instance_id?: string | null;
          title: string;
          assignee_id?: string | null;
          due_date?: string | null;
          status?: Database["public"]["Enums"]["task_status"];
          kind?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          requirement_instance_id?: string | null;
          title?: string;
          assignee_id?: string | null;
          due_date?: string | null;
          status?: Database["public"]["Enums"]["task_status"];
          kind?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      training_records: {
        Row: {
          id: string;
          staff_id: string;
          course_title: string;
          provider: string | null;
          completion_date: string;
          minutes: number;
          category: string | null;
          registry_verified: boolean;
          certificate_identifier: string | null;
          evidence_id: string | null;
          reporting_period_id: string | null;
          state: Database["public"]["Enums"]["training_state"];
          reviewer_id: string | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          staff_id: string;
          course_title: string;
          provider?: string | null;
          completion_date: string;
          minutes: number;
          category?: string | null;
          registry_verified?: boolean;
          certificate_identifier?: string | null;
          evidence_id?: string | null;
          reporting_period_id?: string | null;
          state?: Database["public"]["Enums"]["training_state"];
          reviewer_id?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          staff_id?: string;
          course_title?: string;
          provider?: string | null;
          completion_date?: string;
          minutes?: number;
          category?: string | null;
          registry_verified?: boolean;
          certificate_identifier?: string | null;
          evidence_id?: string | null;
          reporting_period_id?: string | null;
          state?: Database["public"]["Enums"]["training_state"];
          reviewer_id?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      training_targets: {
        Row: {
          id: string;
          role_title: string;
          reporting_period_id: string;
          target_minutes: number;
          confirmed: boolean;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          role_title: string;
          reporting_period_id: string;
          target_minutes: number;
          confirmed?: boolean;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          role_title?: string;
          reporting_period_id?: string;
          target_minutes?: number;
          confirmed?: boolean;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      v_credentials: {
        Row: {
          id: string | null;
          staff_id: string | null;
          staff_name: string | null;
          employment_status: Database["public"]["Enums"]["employment_status"] | null;
          classroom_id: string | null;
          credential_type_id: string | null;
          credential_name: string | null;
          requires_expiration: boolean | null;
          issuer: string | null;
          issue_date: string | null;
          expiration_date: string | null;
          internal_review_date: string | null;
          eligibility_status: string | null;
          evidence_id: string | null;
          reviewer_id: string | null;
          verified_at: string | null;
          renewal_owner_id: string | null;
          deadline_status: Database["public"]["Enums"]["deadline_status"] | null;
          is_verified_current: boolean | null;
          is_latest: boolean | null;
        };
        Relationships: [];
      };
      v_deadline_items: {
        Row: {
          kind: string | null;
          id: string | null;
          title: string | null;
          subject_label: string | null;
          subject_type: Database["public"]["Enums"]["applicability_scope"] | null;
          subject_id: string | null;
          classroom_id: string | null;
          owner_id: string | null;
          backup_id: string | null;
          due_date: string | null;
          deadline_status: Database["public"]["Enums"]["deadline_status"] | null;
          verified: boolean | null;
          criticality: Database["public"]["Enums"]["criticality"] | null;
          authority_code: Database["public"]["Enums"]["authority_code"] | null;
        };
        Relationships: [];
      };
      v_requirement_status: {
        Row: {
          requirement_instance_id: string | null;
          requirement_version_id: string | null;
          requirement_id: string | null;
          requirement_code: string | null;
          requirement_title: string | null;
          requirement_category: string | null;
          authority_code: Database["public"]["Enums"]["authority_code"] | null;
          criticality: Database["public"]["Enums"]["criticality"] | null;
          version_status: Database["public"]["Enums"]["lifecycle_status"] | null;
          subject_type: Database["public"]["Enums"]["applicability_scope"] | null;
          subject_id: string | null;
          owner_id: string | null;
          backup_id: string | null;
          reviewer_id: string | null;
          due_date: string | null;
          cycle_number: number | null;
          closed_at: string | null;
          evidence_status: Database["public"]["Enums"]["evidence_status"] | null;
          deadline_status: Database["public"]["Enums"]["deadline_status"] | null;
          is_green: boolean | null;
          subject_label: string | null;
          classroom_id: string | null;
          frequency: Database["public"]["Enums"]["frequency_type"] | null;
          recurrence_rule: Json | null;
          verified_at: string | null;
          subject_hire_date: string | null;
        };
        Relationships: [];
      };
      v_review_queue: {
        Row: {
          link_id: string | null;
          status: Database["public"]["Enums"]["link_status"] | null;
          submitted_at: string | null;
          reviewed_at: string | null;
          correction_note: string | null;
          evidence_id: string | null;
          file_name: string | null;
          doc_type: string | null;
          access_class: Database["public"]["Enums"]["access_class"] | null;
          issue_date: string | null;
          expiry_date: string | null;
          uploader_id: string | null;
          requirement_instance_id: string | null;
          requirement_code: string | null;
          requirement_title: string | null;
          authority_code: Database["public"]["Enums"]["authority_code"] | null;
          version_status: Database["public"]["Enums"]["lifecycle_status"] | null;
          subject_label: string | null;
          subject_type: Database["public"]["Enums"]["applicability_scope"] | null;
          subject_id: string | null;
          due_date: string | null;
          frequency: Database["public"]["Enums"]["frequency_type"] | null;
          recurrence_rule: Json | null;
          instance_verified_at: string | null;
          subject_hire_date: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      auth_role: { Args: Record<PropertyKey, never>; Returns: Database["public"]["Enums"]["app_role"] | null };
      auth_staff_id: { Args: Record<PropertyKey, never>; Returns: string | null };
      can_access_class: { Args: { cls: Database["public"]["Enums"]["access_class"] }; Returns: boolean };
      chicago_today: { Args: Record<PropertyKey, never>; Returns: string };
      generate_instances: { Args: { p_version?: string | null }; Returns: number };
      review_evidence_link: { Args: { p_link: string; p_decision: Database["public"]["Enums"]["link_status"]; p_note?: string | null; p_next_due?: string | null; p_set_due?: boolean }; Returns: string };
      classroom_file_indicators: { Args: { p_classroom: string }; Returns: { subject_type: Database["public"]["Enums"]["applicability_scope"]; subject_label: string; requirement_title: string; present: boolean }[] };
      profile_names: { Args: { ids: string[] }; Returns: { id: string; display_name: string }[] };
    };
    Enums: {
      access_class: "general" | "personnel" | "child_health" | "restricted";
      app_role: "director" | "admin_support" | "educator" | "classroom_reviewer" | "auditor";
      applicability_scope: "program" | "role" | "classroom" | "staff" | "child" | "facility";
      authority_code: "DHS" | "STARS" | "APPLE" | "CECPD" | "INTERNAL";
      criticality: "safety_critical" | "regulatory" | "accreditation" | "internal";
      deadline_status: "none" | "current" | "due_soon" | "urgent" | "overdue";
      delivery_status: "queued" | "sent" | "failed" | "suppressed";
      employment_status: "active" | "on_leave" | "separated";
      evidence_status: "missing" | "pending_review" | "needs_correction" | "verified" | "not_applicable" | "unknown";
      frequency_type: "one_time" | "recurring" | "expiration_based" | "event_triggered";
      lifecycle_status: "draft" | "active" | "superseded" | "archived";
      link_status: "pending" | "approved" | "rejected";
      reminder_milestone: "d90" | "d60" | "d30" | "d14" | "d7" | "due" | "overdue" | "rejected" | "critical";
      task_status: "open" | "in_progress" | "done" | "cancelled";
      training_state: "pending" | "verified" | "ineligible";
    };
    CompositeTypes: Record<PropertyKey, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type Views<T extends keyof Database["public"]["Views"]> = Database["public"]["Views"][T]["Row"];
export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];

export const Constants = {
  public: {
    Enums: {
      access_class: ["general", "personnel", "child_health", "restricted"],
      app_role: ["director", "admin_support", "educator", "classroom_reviewer", "auditor"],
      applicability_scope: ["program", "role", "classroom", "staff", "child", "facility"],
      authority_code: ["DHS", "STARS", "APPLE", "CECPD", "INTERNAL"],
      criticality: ["safety_critical", "regulatory", "accreditation", "internal"],
      deadline_status: ["none", "current", "due_soon", "urgent", "overdue"],
      delivery_status: ["queued", "sent", "failed", "suppressed"],
      employment_status: ["active", "on_leave", "separated"],
      evidence_status: ["missing", "pending_review", "needs_correction", "verified", "not_applicable", "unknown"],
      frequency_type: ["one_time", "recurring", "expiration_based", "event_triggered"],
      lifecycle_status: ["draft", "active", "superseded", "archived"],
      link_status: ["pending", "approved", "rejected"],
      reminder_milestone: ["d90", "d60", "d30", "d14", "d7", "due", "overdue", "rejected", "critical"],
      task_status: ["open", "in_progress", "done", "cancelled"],
      training_state: ["pending", "verified", "ineligible"],
    },
  },
} as const;
