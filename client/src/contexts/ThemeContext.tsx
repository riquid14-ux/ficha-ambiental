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
        rootEl.style.filter = "invert(1) hue-rotate(180deg)";
        const reInvert = (el: Element) => { (el as HTMLElement).style.filter = "invert(1) hue-rotate(180deg)"; };
        // Re-invert media AND sidebar (sidebar is already dark, inversion makes it light)
        const mediaSelector = "img, video, canvas, picture, .recharts-wrapper, iframe, [data-slot='sidebar']";
        rootEl.querySelectorAll(mediaSelector).forEach(reInvert);
        // MutationObserver to handle dynamically loaded images/iframes
        const observer = new MutationObserver((mutations) => {
          mutations.forEach(m => {
            m.addedNodes.forEach(node => {
              if (node instanceof HTMLElement) {
                if (node.matches?.(mediaSelector)) reInvert(node);
                node.querySelectorAll?.(mediaSelector).forEach(reInvert);
              }
            });
          });
        });
        observer.observe(rootEl, { childList: true, subtree: true });
        // Store observer for cleanup
        (rootEl as any).__darkObserver = observer;
      } else {
        rootEl.style.filter = "";
        rootEl.querySelectorAll("img, video, canvas, picture, .recharts-wrapper, iframe").forEach(el => {
          (el as HTMLElement).style.filter = "";
        });
        // Disconnect observer
        if ((rootEl as any).__darkObserver) {
          (rootEl as any).__darkObserver.disconnect();
          delete (rootEl as any).__darkObserver;
        }
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
