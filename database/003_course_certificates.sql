-- Elitea course certificates — immutable issuance records.
-- Apply on a preview branch first. The visual template is supplied separately;
-- this table stores the trustworthy facts printed into that design.

CREATE TABLE IF NOT EXISTS course_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES member_profiles(user_id) ON DELETE CASCADE,
  course_id text NOT NULL,
  course_title text NOT NULL,
  certificate_title text NOT NULL,
  member_name text NOT NULL,
  completed_at timestamptz NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  issued_by text NOT NULL DEFAULT 'Nia Dobyšar',
  qualification_note text NOT NULL,
  template_version text NOT NULL,
  verification_hash text NOT NULL UNIQUE,
  revoked_at timestamptz,
  revocation_reason text
);

CREATE UNIQUE INDEX IF NOT EXISTS course_certificates_user_course_idx
  ON course_certificates (user_id, course_id) WHERE revoked_at IS NULL;

ALTER TABLE course_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY course_certificates_read_own_rows ON course_certificates
  FOR SELECT USING (auth.user_id() = user_id);
