import { SignIn, SignUp } from "@clerk/clerk-react";
import { ThemeToggle } from "../theme";

interface AuthScreenProps {
  mode: "sign-in" | "sign-up";
  onModeChange: (m: "sign-in" | "sign-up") => void;
  onBack: () => void;
}

export function AuthScreen({ mode, onModeChange, onBack }: AuthScreenProps) {
  return (
    <>
      <header className="header-row">
        <div className="brand">
          <h1>
            Style<span className="accent">Twin</span>
          </h1>
        </div>
        <ThemeToggle />
      </header>

      <div className="auth-screen">
        <button className="back-link" onClick={onBack}>
          ← Back to home
        </button>

        <div className="auth-tabs">
          <button
            className={`tab ${mode === "sign-in" ? "active" : ""}`}
            onClick={() => onModeChange("sign-in")}
          >
            Sign in
          </button>
          <button
            className={`tab ${mode === "sign-up" ? "active" : ""}`}
            onClick={() => onModeChange("sign-up")}
          >
            Create account
          </button>
        </div>

        <div className="auth-card">
          {mode === "sign-in" ? (
            <SignIn routing="hash" signUpUrl="#sign-up" />
          ) : (
            <SignUp routing="hash" signInUrl="#sign-in" />
          )}
        </div>
      </div>
    </>
  );
}
