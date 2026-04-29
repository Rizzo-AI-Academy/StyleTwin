import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App";
import { ThemeProvider, useTheme } from "./theme";
import "./styles.css";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

if (!PUBLISHABLE_KEY) {
  console.warn(
    "Missing VITE_CLERK_PUBLISHABLE_KEY. Set it in frontend/.env to enable authentication."
  );
}

const DARK_APPEARANCE = {
  variables: {
    colorPrimary: "#d9b378",
    colorBackground: "#1f1a15",
    colorText: "#f7efe1",
    colorTextSecondary: "#c2b6a3",
    colorInputBackground: "#2f261d",
    colorInputText: "#f7efe1",
  },
};

const LIGHT_APPEARANCE = {
  variables: {
    colorPrimary: "#b8924a",
    colorBackground: "#ffffff",
    colorText: "#14110e",
    colorTextSecondary: "#6f6557",
    colorInputBackground: "#fbf6ec",
    colorInputText: "#14110e",
  },
};

function ClerkWithTheme({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const appearance = theme === "dark" ? DARK_APPEARANCE : LIGHT_APPEARANCE;
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY ?? ""} appearance={appearance}>
      {children}
    </ClerkProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <ClerkWithTheme>
        <App />
      </ClerkWithTheme>
    </ThemeProvider>
  </React.StrictMode>
);
