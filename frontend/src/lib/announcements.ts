import { request } from "./server";

export type Audience = "ALL" | "APPLIED" | "SHORTLISTED" | "INTERVIEW_SELECTED";
export type Category = "GENERAL" | "MEETING" | "INTERVIEW" | "DEADLINE" | "UPDATE";

export const AUDIENCE_LABEL: Record<Audience, string> = {
  ALL: "All students",
  APPLIED: "Applicants (applied)",
  SHORTLISTED: "Shortlisted",
  INTERVIEW_SELECTED: "Interview selected (hired)",
};

export const CATEGORY_LABEL: Record<Category, string> = {
  GENERAL: "General",
  MEETING: "Placement Meeting",
  INTERVIEW: "Interview",
  DEADLINE: "Deadline",
  UPDATE: "Important Update",
};

export interface AnnouncementItem {
  id: string;
  title: string;
  message: string;
  category: Category;
  isUrgent: boolean;
  audience: Audience;
  eventAt: string | null;
  venue: string | null;
  meetingUrl: string | null;
  createdAt: string;
  company: { id: string; name: string } | null;
  job: { id: string; title: string } | null;
  recipientCount: number;
  unreadCount: number;
}

export interface NoticeItem {
  id: string;
  readAt: string | null;
  createdAt: string;
  announcement: AnnouncementItem & { recipientCount?: number; unreadCount?: number };
}

interface Envelope<T> {
  ok: boolean;
  data: T;
}

export function listAnnouncements(): Promise<{
  data: AnnouncementItem[];
  meta: { published: number; totalRecipients: number; unreadTotal: number };
}> {
  return request<Envelope<AnnouncementItem[]> & { meta: { published: number; totalRecipients: number; unreadTotal: number } }>(
    "/api/announcements?limit=50",
  ).then((r) => ({ data: r.data, meta: r.meta }));
}

export function previewRecipients(audience: Audience, jobId?: string): Promise<number> {
  const q = new URLSearchParams({ audience, ...(jobId ? { jobId } : {}) });
  return request<Envelope<{ recipientCount: number }>>(
    `/api/announcements/recipients/preview?${q}`,
  ).then((r) => r.data.recipientCount);
}

export interface PublishInput {
  title: string;
  message: string;
  audience: Audience;
  jobId?: string;
  category: Category;
  isUrgent: boolean;
  eventAt?: string;
  venue?: string;
  meetingUrl?: string;
}

export function publishAnnouncement(input: PublishInput): Promise<{ recipientCount: number }> {
  return request<Envelope<{ recipientCount: number }>>("/api/announcements", {
    method: "POST",
    body: JSON.stringify(input),
  }).then((r) => r.data);
}

export function inbox(): Promise<NoticeItem[]> {
  return request<Envelope<NoticeItem[]>>("/api/notifications?limit=50").then((r) => r.data);
}

export function unreadCount(): Promise<number> {
  return request<Envelope<{ count: number }>>("/api/notifications/unread-count").then(
    (r) => r.data.count,
  );
}

export function markRead(id: string): Promise<void> {
  return request(`/api/notifications/${id}/read`, { method: "POST" }).then(() => undefined);
}

export function markAllRead(): Promise<number> {
  return request<Envelope<{ updated: number }>>("/api/notifications/read-all", {
    method: "POST",
  }).then((r) => r.data.updated);
}
