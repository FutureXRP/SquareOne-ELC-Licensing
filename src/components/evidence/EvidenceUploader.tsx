"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createEvidence, linkUploaded } from "@/actions/evidence";
import { Field, FormGrid, Select, TextField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/browser";

type Option = { value: string; label: string };

/**
 * Upload a document: record it, send the file straight to private storage, then link it
 * to the requirement as pending. Nothing is verified by uploading.
 */
export function EvidenceUploader({
  subjectType,
  subjectId,
  instanceId,
  instances,
  accessClasses,
}: {
  subjectType: string;
  subjectId: string;
  /** Fixed requirement item, or let the person choose from `instances`. */
  instanceId?: string;
  instances?: Option[];
  accessClasses: Option[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setMessage({ ok: false, text: "Choose a file." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const chosenInstance = instanceId ?? String(fd.get("requirement_instance_id") ?? "");
      const created = await createEvidence({
        doc_type: String(fd.get("doc_type") ?? ""),
        file_name: file.name,
        file_size: String(file.size),
        access_class: String(fd.get("access_class") ?? ""),
        subject_type: subjectType,
        subject_id: subjectId,
        issue_date: String(fd.get("issue_date") ?? ""),
        expiry_date: String(fd.get("expiry_date") ?? ""),
      });
      if (!created.ok) {
        setMessage({ ok: false, text: created.message });
        return;
      }
      const { error } = await createClient().storage.from("evidence").upload(created.path, file, { upsert: false });
      if (error) {
        setMessage({ ok: false, text: "The file did not upload, so nothing was submitted. Try again." });
        return;
      }
      if (chosenInstance) {
        const linked = await linkUploaded(created.id, chosenInstance);
        setMessage({ ok: linked.ok, text: linked.message });
      } else {
        setMessage({ ok: true, text: "Uploaded. It is on file but not linked to a requirement yet." });
      }
      form.reset();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <FormGrid>
        <Field label="File (up to 20 MB)" name="file">
          <Input id="file" name="file" type="file" required accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.doc,.docx,.xls,.xlsx,.csv,.txt" />
        </Field>
        <TextField label="Document type" name="doc_type" required maxLength={80} placeholder="Certificate, form, letter…" />
        <Field label="Who may see it" name="access_class">
          <Select id="access_class" name="access_class" required defaultValue={accessClasses[0]?.value}>
            {accessClasses.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <TextField label="Issue date (optional)" name="issue_date" type="date" />
        <TextField label="Expiry date on the document (optional)" name="expiry_date" type="date" />
        {!instanceId && instances ? (
          <Field label="Requirement it supports" name="requirement_instance_id">
            <Select id="requirement_instance_id" name="requirement_instance_id" defaultValue="">
              <option value="">Not linked yet</option>
              {instances.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
      </FormGrid>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? "Uploading…" : "Upload for review"}
        </Button>
        {message ? (
          <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-sm text-status-green" : "text-sm text-status-red"}>
            {message.text}
          </p>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">Uploading does not complete a requirement. A director reviews each submission.</p>
    </form>
  );
}
