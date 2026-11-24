-- 0001_enums.sql
-- Enumerated types for the SquareOne ELC Compliance Center (BUILD.md section 5).

create type public.app_role as enum
  ('director', 'admin_support', 'educator', 'classroom_reviewer', 'auditor');
create type public.employment_status as enum ('active', 'on_leave', 'separated');
create type public.authority_code as enum ('DHS', 'STARS', 'APPLE', 'CECPD', 'INTERNAL');
create type public.lifecycle_status as enum ('draft', 'active', 'superseded', 'archived');
create type public.applicability_scope as enum
  ('program', 'role', 'classroom', 'staff', 'child', 'facility');
create type public.frequency_type as enum
  ('one_time', 'recurring', 'expiration_based', 'event_triggered');
create type public.criticality as enum
  ('safety_critical', 'regulatory', 'accreditation', 'internal');
create type public.evidence_status as enum
  ('missing', 'pending_review', 'needs_correction', 'verified', 'not_applicable', 'unknown');
create type public.deadline_status as enum ('none', 'current', 'due_soon', 'urgent', 'overdue');
create type public.link_status as enum ('pending', 'approved', 'rejected');
create type public.access_class as enum ('general', 'personnel', 'child_health', 'restricted');
create type public.training_state as enum ('pending', 'verified', 'ineligible');
create type public.task_status as enum ('open', 'in_progress', 'done', 'cancelled');
create type public.reminder_milestone as enum
  ('d90', 'd60', 'd30', 'd14', 'd7', 'due', 'overdue', 'rejected', 'critical');
create type public.delivery_status as enum ('queued', 'sent', 'failed', 'suppressed');
