import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme?: () => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (switchable) {
      const stored = localStorage.getItem("theme");
      return (stored as Theme) || defaultTheme;
    }
    return defaultTheme;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      document.body.style.backgroundColor = "#0f172a";
    } else {
      root.classList.remove("dark");
      document.body.style.backgroundColor = "";
    }
    // Apply filter directly to #root element via inline style — guarantees dark mode
    const rootEl = document.getElementById("root");
    if (rootEl) {
      if (theme === "dark") {
        rootEl.style.filter = "invert(0.88) hue-rotate(180deg)";
        // Re-invert images so they look normal
        rootEl.querySelectorAll("img, video, canvas, picture, .recharts-wrapper").forEach(el => {
          (el as HTMLElement).style.filter = "invert(1) hue-rotate(180deg)";
        });
      } else {
        rootEl.style.filter = "";
        rootEl.querySelectorAll("img, video, canvas, picture, .recharts-wrapper").forEach(el => {
          (el as HTMLElement).style.filter = "";
        });
      }
    }
    if (switchable) {
      localStorage.setItem("theme", theme);
    }
  }, [theme, switchable]);

  const toggleTheme = switchable
    ? () => {
        setTheme(prev => (prev === "light" ? "dark" : "light"));
      }
    : undefined;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, switchable }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
