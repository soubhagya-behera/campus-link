import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Card, DemoTag, Empty, ErrorState, Loading, SectionTitle } from "../components/ui";
import "../components/staff.css";
import {
  AUDIENCE_LABEL,
  CATEGORY_LABEL,
  listAnnouncements,
  previewRecipients,
  publishAnnouncement,
  type Audience,
  type Category,
} from "../lib/announcements";
import { api, type Opportunity } from "../lib/server";
import { isPlacement, useSessionUser } from "../store/session";

const CATEGORIES = Object.keys(CATEGORY_LABEL) as Category[];
const AUDIENCES = Object.keys(AUDIENCE_LABEL) as Audience[];

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso.slice(0, 16).replace("T", " ") : d.toLocaleString();
}

/**
 * Staff announcement management: summary from persisted records, history,
 * and a create form with live recipient preview + explicit confirmation.
 * No dummy notices; publishing is disabled for empty audiences.
 */
export default function StaffAnnouncements() {
  const user = useSessionUser();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<Audience>("ALL");
  const [jobId, setJobId] = useState("");
  const [category, setCategory] = useState<Category>("GENERAL");
  const [isUrgent, setIsUrgent] = useState(false);
  const [eventAt, setEventAt] = useState("");
  const [venue, setVenue] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [noticeSent, setNoticeSent] = useState<string | null>(null);

  const list = useQuery({ queryKey: ["announcements"], queryFn: listAnnouncements, enabled: isPlacement(user) });
  const drives = useQuery({
    queryKey: ["announcement-drives"],
    queryFn: () => api.opportunities({ status: "ALL", limit: 50 }).then((r) => r.data),
    enabled: isPlacement(user) && showForm,
  });
  const needsDrive = audience !== "ALL";
  const preview = useQuery({
    queryKey: ["announcement-preview", audience, jobId],
    queryFn: () => previewRecipients(audience, jobId || undefined),
    enabled: isPlacement(user) && showForm && (!needsDrive || !!jobId),
  });

  const publish = useMutation({
    mutationFn: () =>
      publishAnnouncement({
        title: title.trim(),
        message: message.trim(),
        audience,
        ...(needsDrive && jobId ? { jobId } : {}),
        category,
        isUrgent,
        ...(eventAt ? { eventAt: new Date(eventAt).toISOString() } : {}),
        ...(venue.trim() ? { venue: venue.trim() } : {}),
        ...(meetingUrl.trim() ? { meetingUrl: meetingUrl.trim() } : {}),
      }),
    onSuccess: (r) => {
      setShowForm(false);
      setConfirming(false);
      setFormError(null);
      void qc.invalidateQueries({ queryKey: ["announcements"] });
      void qc.invalidateQueries({ queryKey: ["announcement-preview"] });
      setNoticeSent(`Published to ${r.recipientCount} student${r.recipientCount === 1 ? "" : "s"}.`);
    },
    onError: (e) => setFormError(e instanceof Error ? e.message : "Publishing failed."),
  });

  if (user && !isPlacement(user)) {
    return (
      <div>
        <SectionTitle kicker="Announcements" title="Placement access only" right={<DemoTag />} />
        <Card className="p-6">
          <p className="text-sm leading-relaxed text-[var(--ws-mute)]">
            Publishing announcements is limited to placement staff accounts.
          </p>
        </Card>
      </div>
    );
  }

  const startCreate = () => {
    setTitle("");
    setMessage("");
    setAudience("ALL");
    setJobId("");
    setCategory("GENERAL");
    setIsUrgent(false);
    setEventAt("");
    setVenue("");
    setMeetingUrl("");
    setFormError(null);
    setConfirming(false);
    setShowForm(true);
  };

  const beginConfirm = () => {
    setFormError(null);
    if (title.trim().length < 3) return setFormError("Title needs at least 3 characters.");
    if (message.trim().length < 10) return setFormError("Message needs at least 10 characters.");
    if (needsDrive && !jobId) return setFormError("Pick the company drive this audience depends on.");
    if (eventAt && Number.isNaN(new Date(eventAt).getTime())) return setFormError("Event date is not valid.");
    if (meetingUrl.trim() && !/^https?:\/\//i.test(meetingUrl.trim())) {
      return setFormError("Meeting URL must start with http(s).");
    }
    if ((preview.data ?? -1) === 0) return setFormError("No students match — adjust the audience before publishing.");
    setConfirming(true);
  };

  const driveName = (drives.data ?? []).find((d: Opportunity) => d.id === jobId);
  const meta = list.data?.meta;

  return (
    <div className="st st-enter">
      <SectionTitle
        kicker="Announcements"
        title="Announcements"
        sub="Send placement updates to the students who need to know."
        right={<DemoTag />}
      />
      {noticeSent && (
        <p role="status" className="mb-3 rounded-xl border border-[var(--ws-forest)] bg-[var(--ws-lime-wash)] p-3 text-sm text-[var(--ws-ink)]">
          {noticeSent}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Notices published", value: meta ? `${meta.published}` : "…" },
          { label: "Total recipients", value: meta ? `${meta.totalRecipients}` : "…" },
          { label: "Unread notifications", value: meta ? `${meta.unreadTotal}` : "…" },
        ].map((k) => (
          <Card key={k.label} className="st-card p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ws-faint)]">{k.label}</p>
            <p className="font-display mt-1 text-3xl font-bold text-[var(--ws-ink)]">{k.value}</p>
          </Card>
        ))}
      </div>

      <div className="mt-4">
        {!showForm ? (
          <button
            onClick={startCreate}
            className="st-btn-forest inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-[var(--ws-forest)] px-4 py-2 text-sm font-semibold text-[var(--ws-canvas)]"
          >
            <Plus size={15} /> Create announcement
          </button>
        ) : (
          <Card className="st-card p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ws-faint)]">New announcement</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <label className="block text-sm font-medium text-[var(--ws-ink)]">
                Title
                <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Notice title" autoComplete="off" spellCheck={false} className="st-input mt-1 min-h-[44px] w-full rounded-lg border border-[var(--ws-line)] bg-[var(--ws-surface)] px-3 py-2 text-sm" />
              </label>
              <label className="block text-sm font-medium text-[var(--ws-ink)]">
                Target audience
                <select value={audience} onChange={(e) => { setAudience(e.target.value as Audience); setConfirming(false); }} className="st-select mt-1 min-h-[44px] w-full rounded-lg border border-[var(--ws-line)] bg-[var(--ws-surface)] px-3 py-2 text-sm">
                  {AUDIENCES.map((a) => (
                    <option key={a} value={a}>{AUDIENCE_LABEL[a]}</option>
                  ))}
                </select>
              </label>
              {needsDrive && (
                <label className="block text-sm font-medium text-[var(--ws-ink)] md:col-span-2">
                  Company drive
                  <select value={jobId} onChange={(e) => { setJobId(e.target.value); setConfirming(false); }} className="st-select mt-1 min-h-[44px] w-full rounded-lg border border-[var(--ws-line)] bg-[var(--ws-surface)] px-3 py-2 text-sm">
                    <option value="">Select a drive…</option>
                    {(drives.data ?? []).map((d: Opportunity) => (
                      <option key={d.id} value={d.id}>{d.title} · {d.company} ({d.status})</option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block text-sm font-medium text-[var(--ws-ink)]">
                Category
                <select value={category} onChange={(e) => setCategory(e.target.value as Category)} className="st-select mt-1 min-h-[44px] w-full rounded-lg border border-[var(--ws-line)] bg-[var(--ws-surface)] px-3 py-2 text-sm">
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
                  ))}
                </select>
              </label>
              <label className="flex min-h-[44px] items-center gap-2 text-sm font-medium text-[var(--ws-ink)]">
                <input type="checkbox" checked={isUrgent} onChange={(e) => setIsUrgent(e.target.checked)} className="h-5 w-5 accent-[#173c2f]" />
                Mark as urgent
              </label>
              <label className="block text-sm font-medium text-[var(--ws-ink)]">
                Event date/time (optional)
                <input type="datetime-local" value={eventAt} onChange={(e) => setEventAt(e.target.value)} autoComplete="off" className="st-input mt-1 min-h-[44px] w-full rounded-lg border border-[var(--ws-line)] bg-[var(--ws-surface)] px-3 py-2 text-sm" />
              </label>
              <label className="block text-sm font-medium text-[var(--ws-ink)]">
                Venue (optional)
                <input value={venue} onChange={(e) => setVenue(e.target.value)} maxLength={120} placeholder="Venue" autoComplete="off" spellCheck={false} className="st-input mt-1 min-h-[44px] w-full rounded-lg border border-[var(--ws-line)] bg-[var(--ws-surface)] px-3 py-2 text-sm" />
              </label>
            </div>
            <label className="mt-2 block text-sm font-medium text-[var(--ws-ink)]">
              Online meeting URL (optional)
              <input value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} inputMode="url" autoComplete="off" spellCheck={false} placeholder="https://…" className="st-input mt-1 min-h-[44px] w-full rounded-lg border border-[var(--ws-line)] bg-[var(--ws-surface)] px-3 py-2 text-sm" />
            </label>
            <label className="mt-2 block text-sm font-medium text-[var(--ws-ink)]">
              Message
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} maxLength={5000} autoComplete="off" spellCheck={false} placeholder="Notice message" className="st-textarea mt-1 w-full rounded-lg border border-[var(--ws-line)] bg-[var(--ws-surface)] px-3 py-2 text-sm leading-relaxed" />
            </label>
            <p className="mt-2 text-sm text-[var(--ws-ink)]" role="status">
              Recipients:{" "}
              <span className="font-bold">
                {preview.isPending ? "counting…" : preview.isError ? "unavailable" : `${preview.data ?? 0} students`}
              </span>
            </p>
            {formError && (
              <p role="alert" className="mt-2 rounded-lg border border-[#e8c6bf] bg-[var(--ws-err-bg)] p-2.5 text-sm text-[var(--ws-err)]">
                {formError}
              </p>
            )}
            {!confirming ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={beginConfirm} disabled={publish.isPending} className="st-btn-forest inline-flex min-h-[44px] items-center rounded-lg bg-[var(--ws-forest)] px-4 py-2 text-sm font-semibold text-[var(--ws-canvas)] disabled:opacity-50">
                  Review before publishing
                </button>
                <button onClick={() => setShowForm(false)} className="st-btn-secondary inline-flex min-h-[44px] items-center rounded-lg border border-[var(--ws-line)] px-4 py-2 text-sm font-medium text-[var(--ws-mute)]">
                  Cancel
                </button>
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-[var(--ws-forest)] p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ws-faint)]">Confirm publication</p>
                <p className="mt-1 text-sm text-[var(--ws-ink)]">
                  <span className="font-bold">{title.trim() || "Untitled"}</span> → {AUDIENCE_LABEL[audience]}
                  {needsDrive && driveName ? ` · ${driveName.title} (${driveName.company})` : ""} ·{" "}
                  {preview.data ?? 0} students
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => publish.mutate()} disabled={publish.isPending} className="st-btn-forest inline-flex min-h-[44px] items-center rounded-lg bg-[var(--ws-forest)] px-4 py-2 text-sm font-semibold text-[var(--ws-canvas)] disabled:opacity-50">
                    {publish.isPending ? "Publishing…" : "Publish now"}
                  </button>
                  <button onClick={() => setConfirming(false)} disabled={publish.isPending} className="st-btn-secondary inline-flex min-h-[44px] items-center rounded-lg border border-[var(--ws-line)] px-4 py-2 text-sm font-medium text-[var(--ws-mute)] disabled:opacity-50">
                    Back to editing
                  </button>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>

      <h2 className="font-display mt-8 text-lg font-bold text-[var(--ws-ink)]">Previously published</h2>
      {list.isPending ? (
        <div className="mt-3"><Loading label="Loading announcements…" /></div>
      ) : list.isError ? (
        <div className="mt-3">
          <ErrorState message="Announcements failed to load" onRetry={() => void qc.invalidateQueries({ queryKey: ["announcements"] })} />
        </div>
      ) : (list.data?.data ?? []).length === 0 ? (
        <div className="mt-3">
          <Empty title="No notices yet" body="Published announcements appear here with their real recipient counts." />
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {(list.data?.data ?? []).map((a) => (
            <li key={a.id} className="st-lift rounded-xl border border-[var(--ws-line)] bg-[var(--ws-surface)] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-base font-bold text-[var(--ws-ink)]">{a.title}</p>
                {a.isUrgent && <Badge tone="rose">Urgent</Badge>}
                <Badge tone="neutral">{CATEGORY_LABEL[a.category]}</Badge>
                <Badge tone="sky">{AUDIENCE_LABEL[a.audience]}</Badge>
              </div>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[var(--ws-mute)]">{a.message}</p>
              <p className="mt-2 font-mono text-[11px] leading-relaxed text-[var(--ws-faint)]">
                {a.company ? `${a.company.name} · ` : ""}{a.recipientCount} recipients · {a.unreadCount} unread · published {fmtDate(a.createdAt)}
                {a.eventAt ? ` · event ${fmtDate(a.eventAt)}${a.venue ? ` · ${a.venue}` : ""}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6">
        <Link to="/tower#reports" className="st-link inline-flex items-center gap-1 text-sm font-medium text-[var(--ws-forest)] hover:underline">
          Back to overview <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </p>
    </div>
  );
}
