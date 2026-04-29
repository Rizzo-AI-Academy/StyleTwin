import { UserButton } from "@clerk/clerk-react";
import { useCallback, useRef, useState } from "react";
import {
  generateReport,
  type GenerationSummary,
  type ReportResponse,
  type ReportType,
  type UserProfile,
} from "../api";
import { ThemeToggle } from "../theme";

const REPORT_OPTIONS: { value: ReportType; label: string }[] = [
  { value: "full_report", label: "Full styling report" },
  { value: "color_analysis", label: "Color analysis" },
  { value: "hairstyle_woman", label: "Hairstyle — woman" },
  { value: "hairstyle_man", label: "Hairstyle — man" },
  { value: "outfit_woman", label: "Outfit — woman" },
  { value: "outfit_man", label: "Outfit — man" },
  { value: "accessories", label: "Accessories" },
  { value: "before_after", label: "Before / After" },
];

interface StudioProps {
  me: UserProfile;
  history: GenerationSummary[];
  tokenGetter: () => Promise<string | null>;
  onRefresh: () => void | Promise<void>;
}

export function Studio({ me, history, tokenGetter, onRefresh }: StudioProps) {
  const defaultReport: ReportType =
    me.gender === "male" ? "outfit_man" :
    me.gender === "female" ? "outfit_woman" :
    "full_report";

  return (
    <>
      <header className="header-row">
        <div className="brand">
          <h1>
            Style<span className="accent">Twin</span>
          </h1>
          <span className="tagline">Welcome back, {me.first_name ?? "stylist"}</span>
        </div>
        <div className="nav-actions">
          <ThemeToggle />
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      <Generator
        defaultReport={defaultReport}
        tokenGetter={tokenGetter}
        onGenerated={onRefresh}
      />

      <ProfileSummary me={me} />

      <HistoryList items={history} />
    </>
  );
}

function ProfileSummary({ me }: { me: UserProfile }) {
  return (
    <div className="card">
      <h2>Your profile</h2>
      <p className="lead">Synced with your Clerk account.</p>
      <div className="profile">
        <Chip k="Name" v={[me.first_name, me.last_name].filter(Boolean).join(" ") || "—"} />
        <Chip k="Email" v={me.email ?? "—"} />
        <Chip k="Age" v={me.age != null ? String(me.age) : "—"} />
        <Chip k="Gender" v={me.gender ?? "—"} />
      </div>
    </div>
  );
}

function Chip({ k, v }: { k: string; v: string }) {
  return (
    <div className="chip">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
    </div>
  );
}

function Generator({
  defaultReport,
  tokenGetter,
  onGenerated,
}: {
  defaultReport: ReportType;
  tokenGetter: () => Promise<string | null>;
  onGenerated: () => void | Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [reportType, setReportType] = useState<ReportType>(defaultReport);
  const [size, setSize] = useState("1024x1536");
  const [quality, setQuality] = useState("high");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReportResponse | null>(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onPick = (f: File | null) => {
    setError(null);
    setResult(null);
    if (!f) {
      setFile(null);
      setPreviewUrl(null);
      return;
    }
    if (!/^image\/(png|jpe?g|webp)$/.test(f.type)) {
      setError("Please upload a PNG, JPEG, or WebP portrait.");
      return;
    }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    onPick(e.dataTransfer.files?.[0] ?? null);
  }, []);

  const submit = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await generateReport(tokenGetter, file, reportType, size, quality);
      setResult(res);
      await onGenerated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="card">
        <h2>Generate a styling report</h2>
        <p className="lead">
          Upload a portrait (PNG/JPG/WebP) and choose what kind of report you want.
        </p>
        <div className="grid">
          <div>
            <div
              className={`dropzone ${previewUrl ? "has-image" : ""} ${drag ? "drag" : ""}`}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={onDrop}
            >
              {previewUrl ? (
                <img src={previewUrl} alt="portrait preview" />
              ) : (
                <>
                  <div className="dropzone-title">Drop your portrait here</div>
                  <div className="dropzone-hint">
                    or click to choose a file (PNG, JPG, WebP)
                  </div>
                </>
              )}
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                style={{ display: "none" }}
                onChange={(e) => onPick(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          <div>
            <label className="field">Report type</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
            >
              {REPORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            <label className="field">Image size</label>
            <select value={size} onChange={(e) => setSize(e.target.value)}>
              <option value="1024x1536">Portrait (1024×1536)</option>
              <option value="1024x1024">Square (1024×1024)</option>
              <option value="1536x1024">Landscape (1536×1024)</option>
              <option value="auto">Auto</option>
            </select>

            <label className="field">Quality</label>
            <select value={quality} onChange={(e) => setQuality(e.target.value)}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="auto">Auto</option>
            </select>

            <div className="actions">
              <button className="btn" disabled={!file || loading} onClick={submit}>
                {loading ? <span className="spinner" /> : null}
                {loading ? "Generating…" : "Generate report"}
              </button>
              {file ? (
                <button
                  className="btn ghost"
                  onClick={() => onPick(null)}
                  disabled={loading}
                >
                  Reset
                </button>
              ) : null}
            </div>

            {loading ? (
              <div className="status">
                <span className="dot" />
                Generating styling report with gpt-image-2 (~30–60s)…
              </div>
            ) : null}

            {error ? <div className="error">{error}</div> : null}
          </div>
        </div>
      </div>

      {result ? (
        <div className="result card">
          <h2>Your styling report</h2>
          <p className="lead">Here is your personalized styling report.</p>
          <img
            src={`data:${result.mime_type};base64,${result.image_b64}`}
            alt="Styling report"
          />
          <div className="actions">
            <a
              className="btn"
              href={`data:${result.mime_type};base64,${result.image_b64}`}
              download={`styletwin-${result.id}.png`}
            >
              Download image
            </a>
          </div>
        </div>
      ) : null}
    </>
  );
}

function HistoryList({ items }: { items: GenerationSummary[] }) {
  if (items.length === 0) return null;
  return (
    <div className="card">
      <h2>Recent generations</h2>
      <p className="lead">Your last styling reports.</p>
      <div className="history">
        {items.map((g) => (
          <div className="history-row" key={g.id}>
            <div>
              <div className="history-type">{g.report_type.replace(/_/g, " ")}</div>
              <div className="history-sub">
                {new Date(g.created_at).toLocaleString()} · {g.size} · {g.quality}
              </div>
            </div>
            <span className={`pill ${g.status}`}>{g.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
