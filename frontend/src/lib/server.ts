/** Typed CAMPUSLINK API client. Server is the authority; mutations throw ApiError. */
import { API_BASE } from "./api";

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function requestImpl<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      // The API is on a different port from this page, so every call is
      // cross-origin. Without this the browser drops the HttpOnly session
      // cookie that /login and /register/complete set, and no request is ever
      // authenticated. Safe here because the session is the credential, not a
      // token we attach by hand.
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError(0, "Cannot reach the API. Start it with `npm run dev` in the backend folder.");
  }
  const body = (await res.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    details?: unknown;
    data?: unknown;
  } | null;
  if (!res.ok || !body || body.ok === false) {
    throw new ApiError(res.status, body?.error ?? `Request failed (${res.status})`, body?.details);
  }
  return body as T;
}

/** Shared JSON client: login/register use this path so cookies travel identically. */
export const request = requestImpl;

export type Level = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT";

export interface SkillRecord {
  id: string;
  skill: string;
  level: Level;
  evidence: string[];
}

export interface ProjectRecord {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  skills: string[];
  createdAt: string;
}

export interface StudentProfile {
  id: string;
  fullName: string;
  email: string | null;
  enrollmentNo: string | null;
  branch: string | null;
  institution: string | null;
  graduationYear: number | null;
  cgpa: number | null;
  resumeUrl: string | null;
  createdAt: string;
  skills: SkillRecord[];
  projects: ProjectRecord[];
}

export interface JobRequirement {
  skill: string;
  minLevel: Level;
}

export interface Opportunity {
  id: string;
  title: string;
  company: string;
  companyId: string;
  location: string | null;
  type: string;
  status: string;
  salary: string | null;
  deadline: string | null;
  description: string;
  requiredSkills: JobRequirement[];
  niceToHave: string[];
  applicationCount?: number;
}

export interface MatchFactor {
  kind: "met" | "gap" | "bonus";
  label: string;
  detail: string;
}

export interface JobMatch {
  /** Job shape from GET /api/students/:id/matches: parsed `required`
   *  requirements and `seniority` included, `requiredSkills` absent. */
  job: Omit<Opportunity, "applicationCount" | "requiredSkills"> & {
    required: JobRequirement[];
    seniority: string | null;
  };
  score: number;
  met: JobRequirement[];
  gaps: JobRequirement[];
  bonuses: string[];
  factors: MatchFactor[];
  nextStep: string;
}

export interface ApplicationRecord {
  id: string;
  status: string;
  appliedAt: string;
  updatedAt: string;
  student?: { id: string; fullName: string; enrollmentNo: string | null; branch: string | null };
  job: {
    id: string;
    title: string;
    company: string;
    location: string | null;
    type: string;
    salary: string | null;
    deadline: string | null;
  };
}

export interface AssessmentRecord {
  id: string;
  title: string;
  description: string | null;
  rewardSkill: string;
  attemptCount: number;
}

export interface AttemptRecord {
  id: string;
  assessmentId: string;
  score: number | null;
  status: string;
  repoUrl: string | null;
  note: string | null;
  feedback: string | null;
  startedAt: string;
  submittedAt: string | null;
  assessment?: { id: string; title: string; rewardSkill: string };
}

export interface Readiness {
  score: number;
  method: string;
  inputs: {
    recordedSkills: number;
    evidencedSkills: number;
    applications: number;
    evaluatedSprints: number;
  };
  skills: SkillRecord[];
}

export interface TowerStats {
  students: number;
  openOpportunities: number;
  applications: number;
  byStatus: Record<string, number>;
  avgReadiness: number;
  readiness: { id: string; fullName: string; branch: string | null; score: number; apps: number }[];
  demoSeedPresent: boolean;
}

export interface StudentRow {
  id: string;
  fullName: string;
  email: string | null;
  enrollmentNo: string | null;
  branch: string | null;
  graduationYear: number | null;
  cgpa: number | null;
  createdAt: string;
  skillCount: number;
  applicationCount: number;
  projectCount: number;
}

/** Mirrors the Prisma `Role` enum; the server is the authority on all of it. */
export type Role = "STUDENT" | "STAFF" | "RECRUITER" | "ADMIN";

/** The caller's identity, exactly as `GET /api/auth/me` returns it. */
export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  companyId: string | null;
  studentProfileId: string | null;
}

interface Envelope<T> {
  ok: boolean;
  data: T;
  page?: number;
  limit?: number;
  total?: number;
  method?: string;
  rubric?: string;
}

export const api = {
  /** Current session, or a 401 ApiError when there is no live session. */
  me(): Promise<SessionUser> {
    return request<Envelope<{ user: SessionUser }>>("/api/auth/me").then((r) => r.data.user);
  },
  /**
   * Exchange credentials for the HttpOnly session cookie. Rejects with a
   * uniform 401 "Invalid email or password" for unknown, wrong or inactive
   * accounts — deliberately the same message for all three.
   */
  login(email: string, password: string): Promise<SessionUser> {
    return request<Envelope<{ user: SessionUser }>>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    }).then((r) => r.data.user);
  },
  /** Revokes the server-side session and clears the cookie. */
  logout(): Promise<void> {
    return request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }).then(() => undefined);
  },
  profile(id: string): Promise<StudentProfile> {
    return request<Envelope<StudentProfile>>(`/api/students/${id}`).then((r) => r.data);
  },
  updateSkills(id: string, skills: { skill: string; level: Level }[]): Promise<void> {
    return request(`/api/students/${id}/skills`, {
      method: "PATCH",
      body: JSON.stringify({ skills }),
    }).then(() => undefined);
  },
  updateSkill(id: string, skillId: string, p: { name?: string; level?: Level }): Promise<void> {
    return request(`/api/students/${id}/skills/${skillId}`, {
      method: "PATCH",
      body: JSON.stringify(p),
    }).then(() => undefined);
  },
  deleteSkill(id: string, skillId: string): Promise<void> {
    return request(`/api/students/${id}/skills/${skillId}`, { method: "DELETE" }).then(() => undefined);
  },
  addProject(id: string, p: { title: string; description?: string; url?: string; skills: string[] }): Promise<ProjectRecord> {
    return request<Envelope<ProjectRecord>>(`/api/students/${id}/projects`, {
      method: "POST",
      body: JSON.stringify(p),
    }).then((r) => r.data);
  },
  matches(id: string, limit = 20): Promise<{ method: string; data: JobMatch[] }> {
    return request<Envelope<JobMatch[]>>(`/api/students/${id}/matches?limit=${limit}`).then((r) => ({
      method: r.method ?? "",
      data: r.data,
    }));
  },
  readiness(id: string): Promise<Readiness> {
    return request<Envelope<Readiness>>(`/api/students/${id}/readiness`).then((r) => ({
      ...r.data,
      method: r.method ?? r.data.method,
    }));
  },
  opportunities(params?: { status?: string; search?: string; page?: number; limit?: number }): Promise<{
    data: Opportunity[];
    total: number;
  }> {
    const q = new URLSearchParams({
      status: params?.status ?? "OPEN",
      ...(params?.search ? { search: params.search } : {}),
      page: String(params?.page ?? 1),
      limit: String(params?.limit ?? 20),
    });
    return request<Envelope<Opportunity[]>>(`/api/opportunities?${q}`).then((r) => ({
      data: r.data,
      total: r.total ?? r.data.length,
    }));
  },
  applications(filter: { studentProfileId?: string; jobId?: string; status?: string; limit?: number }): Promise<ApplicationRecord[]> {
    const q = new URLSearchParams({
      ...(filter.studentProfileId ? { studentProfileId: filter.studentProfileId } : {}),
      ...(filter.jobId ? { jobId: filter.jobId } : {}),
      ...(filter.status && filter.status !== "All" ? { status: filter.status } : {}),
      limit: String(filter.limit ?? 50),
    });
    return request<Envelope<ApplicationRecord[]>>(`/api/applications?${q}`).then((r) => r.data);
  },
  apply(jobId: string, studentProfileId: string): Promise<{ id: string }> {
    return request<Envelope<{ id: string }>>("/api/applications", {
      method: "POST",
      body: JSON.stringify({ jobId, studentProfileId }),
    }).then((r) => r.data);
  },
  /** One opportunity by id. Same visibility rules as the list. */
  opportunity(id: string): Promise<Opportunity> {
    return request<Envelope<Opportunity>>(`/api/opportunities/${id}`).then((r) => r.data);
  },
  /** One application with candidate + job. Staff any; students own; recruiters own-company. */
  application(id: string): Promise<ApplicationRecord> {
    return request<Envelope<ApplicationRecord>>(`/api/applications/${id}`).then((r) => r.data);
  },
  setApplicationStatus(id: string, status: string): Promise<void> {
    return request(`/api/applications/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }).then(() => undefined);
  },
  assessments(): Promise<{ data: AssessmentRecord[]; rubric: string }> {
    return request<Envelope<AssessmentRecord[]>>("/api/assessments").then((r) => ({
      data: r.data,
      rubric: r.rubric ?? "",
    }));
  },
  attempts(studentProfileId: string): Promise<{ data: AttemptRecord[]; rubric: string }> {
    return request<Envelope<AttemptRecord[]>>(
      `/api/attempts?studentProfileId=${studentProfileId}`,
    ).then((r) => ({ data: r.data, rubric: r.rubric ?? "" }));
  },
  submitAttempt(input: {
    assessmentId: string;
    studentProfileId: string;
    repoUrl: string;
    note: string;
    tasksDone: number;
    taskCount: number;
  }): Promise<{ attempt: AttemptRecord; promotedTo: string | null; evidenceProjectId: string | null }> {
    return request<
      Envelope<{ attempt: AttemptRecord; promotedTo: string | null; evidenceProjectId: string | null }>
    >("/api/attempts", { method: "POST", body: JSON.stringify(input) }).then((r) => r.data);
  },
  towerStats(): Promise<TowerStats> {
    return request<Envelope<TowerStats>>("/api/tower/stats").then((r) => r.data);
  },
  students(params?: { search?: string; branch?: string; page?: number; limit?: number }): Promise<{
    data: StudentRow[];
    total: number;
  }> {
    const q = new URLSearchParams({
      ...(params?.search ? { search: params.search } : {}),
      ...(params?.branch && params.branch !== "All" ? { branch: params.branch } : {}),
      page: String(params?.page ?? 1),
      limit: String(params?.limit ?? 20),
    });
    return request<Envelope<StudentRow[]>>(`/api/students?${q}`).then((r) => ({
      data: r.data,
      total: r.total ?? r.data.length,
    }));
  },
};
