import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BellRing, CheckCheck } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Card, DemoTag, Empty, ErrorState, Loading, SectionTitle } from "../components/ui";
import { cn } from "../lib/cn";
import {
  CATEGORY_LABEL,
  inbox,
  markAllRead,
  markRead,
  unreadCount,
  type NoticeItem,
} from "../lib/announcements";
import { useProfileId, useSessionUser } from "../store/session";

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso.slice(0, 16).replace("T", " ") : d.toLocaleString();
}

function NoticeCard({
  notice,
  open,
  onToggle,
  pending,
}: {
  notice: NoticeItem;
  open: boolean;
  onToggle: () => void;
  pending: boolean;
}) {
  const a = notice.announcement;
  const unread = !notice.readAt;
  return (
    <li
      className={cn(
        "rounded-xl border bg-[var(--ws-surface)] p-4",
        unread ? "border-[var(--ws-forest)]" : "border-[var(--ws-line)]",
      )}
    >
      <button
        onClick={onToggle}
        aria-expanded={open}
        disabled={pending}
        className="flex w-full items-start gap-3 text-left"
      >
        <span
          aria-hidden="true"
          className={cn(
            "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
            unread ? "bg-[var(--ws-forest)]" : "bg-[var(--ws-line)]",
          )}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold leading-snug text-[var(--ws-ink)]">
            {a.title}
          </span>
          {!open && (
            <span className="mt-0.5 block truncate text-sm text-[var(--ws-mute)]">{a.message}</span>
          )}
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge tone={a.isUrgent ? "rose" : "neutral"}>{CATEGORY_LABEL[a.category]}</Badge>
            {a.company && <span className="text-xs text-[var(--ws-mute)]">{a.company.name}</span>}
            <span className="font-mono text-[11px] text-[var(--ws-faint)]">{fmtDate(a.createdAt)}</span>
          </span>
        </span>
      </button>
      {open && (
        <div className="mt-3 border-t border-[var(--ws-line)] pt-3">
          <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--ws-ink)]">{a.message}</p>
          {(a.eventAt || a.venue || a.meetingUrl) && (
            <p className="mt-2 text-sm text-[var(--ws-ink)]">
              {a.eventAt ? <span className="font-semibold">Event: {fmtDate(a.eventAt)}</span> : null}
              {a.venue ? <span className="block text-[var(--ws-mute)]">Venue: {a.venue}</span> : null}
              {a.meetingUrl ? (
                <a href={a.meetingUrl} target="_blank" rel="noreferrer" className="block break-all font-medium text-[var(--ws-forest)] hover:underline">
                  Join meeting
                </a>
              ) : null}
            </p>
          )}
          {a.job && (
            <p className="mt-2">
              <Link to="/mirror" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--ws-forest)] hover:underline">
                View related drive <ArrowRight size={13} aria-hidden="true" />
              </Link>
            </p>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Student notification inbox: persisted notices, server-side read state,
 * mark-all-read scoped to the caller. Queries are profile-scoped so signing
 * in as someone else never shows stale rows.
 */
export default function Notifications() {
  const user = useSessionUser();
  const profileId = useProfileId();
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["notifications", profileId],
    queryFn: inbox,
    enabled: !!profileId,
    refetchInterval: 30_000,
  });
  const unread = useQuery({
    queryKey: ["notifications-unread", profileId],
    queryFn: unreadCount,
    enabled: !!profileId,
    refetchInterval: 30_000,
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["notifications", profileId] });
    void qc.invalidateQueries({ queryKey: ["notifications-unread", profileId] });
  };

  const toggle = async (n: NoticeItem) => {
    if (pendingId) return;
    if (openId === n.id) {
      setOpenId(null);
      return;
    }
    setOpenId(n.id);
    if (!n.readAt) {
      setPendingId(n.id);
      try {
        await markRead(n.id);
        refresh();
      } catch {
        // Row stays visibly unread; the next focus refetch reconciles.
      } finally {
        setPendingId(null);
      }
    }
  };

  const allRead = useMutation({
    mutationFn: markAllRead,
    onSuccess: refresh,
  });

  if (user && !profileId) {
    return (
      <div>
        <SectionTitle kicker="Notifications" title="Student notifications" right={<DemoTag />} />
        <Card className="p-6">
          <p className="text-sm text-[var(--ws-mute)]">Notifications are available on student accounts.</p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <SectionTitle
        kicker="Notifications"
        title="Notifications"
        sub={unread.data ? `${unread.data} unread` : "Your placement updates."}
        right={<DemoTag />}
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => allRead.mutate()}
          disabled={allRead.isPending || !unread.data}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[var(--ws-forest)] px-4 py-2 text-sm font-semibold text-[var(--ws-forest)] disabled:opacity-50"
        >
          <CheckCheck size={15} /> {allRead.isPending ? "Marking…" : "Mark all as read"}
        </button>
        {allRead.isError && (
          <p role="alert" className="text-sm text-[var(--ws-err)]">Could not mark all as read.</p>
        )}
      </div>

      {list.isPending ? (
        <Loading label="Loading notifications…" />
      ) : list.isError ? (
        <ErrorState
          message="Notifications failed to load"
          onRetry={() => void qc.invalidateQueries({ queryKey: ["notifications", profileId] })}
        />
      ) : (list.data ?? []).length === 0 ? (
        <Empty
          title="You're all caught up."
          body="Placement notices from your cell appear here."
          action={<BellRing size={20} aria-hidden="true" />}
        />
      ) : (
        <ul className="space-y-2">
          {(list.data ?? []).map((n) => (
            <NoticeCard key={n.id} notice={n} open={openId === n.id} pending={pendingId === n.id} onToggle={() => void toggle(n)} />
          ))}
        </ul>
      )}
    </div>
  );
}
