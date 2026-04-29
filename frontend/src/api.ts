export type ReportType =
  | "full_report"
  | "color_analysis"
  | "hairstyle_woman"
  | "hairstyle_man"
  | "outfit_woman"
  | "outfit_man"
  | "accessories"
  | "before_after";

export interface ReportResponse {
  id: number;
  report_type: ReportType;
  image_b64: string;
  mime_type: string;
}

export interface UserProfile {
  id: number;
  clerk_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  age: number | null;
  gender: string | null;
  image_url: string | null;
  onboarded_at: string | null;
}

export interface UserUpdatePayload {
  first_name?: string | null;
  last_name?: string | null;
  age?: number | null;
  gender?: string | null;
  complete_onboarding?: boolean;
}

export interface GenerationSummary {
  id: number;
  report_type: ReportType;
  size: string;
  quality: string;
  status: string;
  created_at: string;
  image_b64: string | null;
  image_mime: string;
}

type TokenGetter = () => Promise<string | null>;

async function authHeaders(getToken: TokenGetter): Promise<HeadersInit> {
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleError(r: Response): Promise<never> {
  let msg = `HTTP ${r.status}`;
  try {
    const j = await r.json();
    if (j?.detail) msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
  } catch {}
  throw new Error(msg);
}

export async function generateReport(
  getToken: TokenGetter,
  portrait: File,
  reportType: ReportType,
  size = "1024x1536",
  quality = "high"
): Promise<ReportResponse> {
  const fd = new FormData();
  fd.append("portrait", portrait);
  fd.append("report_type", reportType);
  fd.append("size", size);
  fd.append("quality", quality);

  const r = await fetch("/api/report", {
    method: "POST",
    body: fd,
    headers: await authHeaders(getToken),
  });
  if (!r.ok) await handleError(r);
  return r.json();
}

export async function getMe(getToken: TokenGetter): Promise<UserProfile> {
  const r = await fetch("/api/me", { headers: await authHeaders(getToken) });
  if (!r.ok) await handleError(r);
  return r.json();
}

export async function updateMe(
  getToken: TokenGetter,
  payload: UserUpdatePayload
): Promise<UserProfile> {
  const r = await fetch("/api/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(await authHeaders(getToken)) },
    body: JSON.stringify(payload),
  });
  if (!r.ok) await handleError(r);
  return r.json();
}

export async function listMyGenerations(
  getToken: TokenGetter,
  limit = 20,
  includeImage = false
): Promise<GenerationSummary[]> {
  const url = `/api/me/generations?limit=${limit}&include_image=${includeImage}`;
  const r = await fetch(url, { headers: await authHeaders(getToken) });
  if (!r.ok) await handleError(r);
  return r.json();
}

export async function getMyGeneration(
  getToken: TokenGetter,
  id: number
): Promise<GenerationSummary> {
  const r = await fetch(`/api/me/generations/${id}`, {
    headers: await authHeaders(getToken),
  });
  if (!r.ok) await handleError(r);
  return r.json();
}
