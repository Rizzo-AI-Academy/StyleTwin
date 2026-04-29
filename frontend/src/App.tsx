import { SignedIn, SignedOut, useAuth } from "@clerk/clerk-react";
import { useCallback, useEffect, useState } from "react";
import {
  getMe,
  listMyGenerations,
  type GenerationSummary,
  type UserProfile,
} from "./api";
import { AuthScreen } from "./components/AuthScreen";
import { Landing } from "./components/Landing";
import { Onboarding } from "./components/Onboarding";
import { Studio } from "./components/Studio";

export default function App() {
  return (
    <div className="app">
      <SignedOut>
        <PublicShell />
      </SignedOut>
      <SignedIn>
        <PrivateShell />
      </SignedIn>
    </div>
  );
}

function PublicShell() {
  const [authMode, setAuthMode] = useState<null | "sign-in" | "sign-up">(null);

  if (authMode) {
    return (
      <AuthScreen
        mode={authMode}
        onModeChange={setAuthMode}
        onBack={() => setAuthMode(null)}
      />
    );
  }
  return (
    <Landing
      onSignIn={() => setAuthMode("sign-in")}
      onSignUp={() => setAuthMode("sign-up")}
    />
  );
}

function PrivateShell() {
  const { getToken } = useAuth();
  const tokenGetter = useCallback(() => getToken(), [getToken]);

  const [me, setMe] = useState<UserProfile | null>(null);
  const [history, setHistory] = useState<GenerationSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const m = await getMe(tokenGetter);
      setMe(m);
      if (m.onboarded_at) {
        const h = await listMyGenerations(tokenGetter, 10, false);
        setHistory(h);
      }
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load profile");
    } finally {
      setBootstrapping(false);
    }
  }, [tokenGetter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (bootstrapping) {
    return (
      <div className="card" style={{ marginTop: 40 }}>
        <div className="status">
          <span className="dot" /> Loading your profile…
        </div>
      </div>
    );
  }

  if (error || !me) {
    return (
      <div className="card" style={{ marginTop: 40 }}>
        <h2>Could not load your profile</h2>
        <div className="error">{error ?? "Unknown error"}</div>
        <div className="actions">
          <button className="btn ghost" onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!me.onboarded_at) {
    return <Onboarding initial={me} tokenGetter={tokenGetter} onDone={refresh} />;
  }

  return <Studio me={me} history={history} tokenGetter={tokenGetter} onRefresh={refresh} />;
}
