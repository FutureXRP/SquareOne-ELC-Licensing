import type { Metadata } from "next";
import { setPassword } from "@/actions/auth";
import { ActionForm } from "@/components/forms/ActionForm";
import { TextField } from "@/components/forms/fields";
import { PageHeader, Section } from "@/components/tables/Table";
import { requireSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Welcome" };

/** Where an invitation link lands: choose a password, then use the app. */
export default async function WelcomePage() {
  const session = await requireSession();
  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Welcome" description={`Signed in as ${session.email}. Choose a password so you can sign in again.`} />
      <Section title="Set your password">
        <ActionForm action={setPassword} submitLabel="Save password">
          <TextField label="New password" name="password" type="password" required minLength={12} autoComplete="new-password" hint="At least 12 characters." />
          <TextField label="Repeat it" name="confirm" type="password" required minLength={12} autoComplete="new-password" />
        </ActionForm>
      </Section>
    </div>
  );
}
