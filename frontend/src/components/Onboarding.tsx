import { UserButton } from "@clerk/clerk-react";
import { useState } from "react";
import { updateMe, type UserProfile } from "../api";
import { ThemeToggle } from "../theme";

interface OnboardingProps {
  initial: UserProfile;
  tokenGetter: () => Promise<string | null>;
  onDone: () => void | Promise<void>;
}

const GENDER_OPTIONS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "neutral", label: "Non-binary" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

export function Onboarding({ initial, tokenGetter, onDone }: OnboardingProps) {
  const [firstName, setFirstName] = useState(initial.first_name ?? "");
  const [lastName, setLastName] = useState(initial.last_name ?? "");
  const [age, setAge] = useState<string>(initial.age != null ? String(initial.age) : "");
  const [gender, setGender] = useState<string>(initial.gender ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = firstName.trim() && lastName.trim() && age && gender;

  const submit = async () => {
    if (!valid) {
      setError("Please fill in every field to continue.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await updateMe(tokenGetter, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        age: Number(age),
        gender,
        complete_onboarding: true,
      });
      await onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save profile");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <header className="header-row">
        <div className="brand">
          <h1>
            Style<span className="accent">Twin</span>
          </h1>
        </div>
        <div className="nav-actions">
          <ThemeToggle />
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      <div className="onboarding">
        <div className="card">
          <h2>Welcome{firstName ? `, ${firstName}` : ""}.</h2>
          <p className="lead">
            Tell us a bit about yourself. We use these details to tailor your
            styling reports — name, age and gender help us recommend the right
            hairstyles and outfits.
          </p>

          <label className="field">First name *</label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Alice"
            autoComplete="given-name"
          />

          <label className="field">Last name *</label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Bianchi"
            autoComplete="family-name"
          />

          <label className="field">Age *</label>
          <input
            type="number"
            min={13}
            max={120}
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="30"
          />

          <label className="field">Gender *</label>
          <div className="gender-options">
            {GENDER_OPTIONS.map((g) => (
              <label key={g.value}>
                <input
                  type="radio"
                  name="gender"
                  value={g.value}
                  checked={gender === g.value}
                  onChange={(e) => setGender(e.target.value)}
                />
                <span>{g.label}</span>
              </label>
            ))}
          </div>

          <div className="actions">
            <button
              className="btn lg"
              onClick={submit}
              disabled={!valid || submitting}
            >
              {submitting ? <span className="spinner" /> : null}
              {submitting ? "Saving…" : "Continue to StyleTwin"}
            </button>
          </div>

          {error ? <div className="error">{error}</div> : null}
        </div>
      </div>
    </>
  );
}
