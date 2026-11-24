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
        };
        Relationships: [];
      };
    };
    Functions: {
      auth_role: { Args: Record<PropertyKey, never>; Returns: Database["public"]["Enums"]["app_role"] | null };
      auth_staff_id: { Args: Record<PropertyKey, never>; Returns: string | null };
      can_access_class: { Args: { cls: Database["public"]["Enums"]["access_class"] }; Returns: boolean };
      chicago_today: { Args: Record<PropertyKey, never>; Returns: string };
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
