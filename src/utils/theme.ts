import { useCallback, useEffect, useState } from "react";

/**
 * Light, dark, or whatever the device says.
 *
 * "system" is the default and stays live — if the OS flips at sunset, so does
 * the app, until the reader picks a side themselves.
 */

export type ThemeChoice = "light" | "dark" | "system";

const STORAGE_KEY = "theme";

const prefersDark = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;

export const readStoredTheme = (): ThemeChoice => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    // Private browsing and blocked storage both land here; system is a fine answer.
    return "system";
  }
};

/** The class the document actually wears, given a choice. */
export const applyTheme = (choice: ThemeChoice): "light" | "dark" => {
  const resolved = choice === "system" ? (prefersDark() ? "dark" : "light") : choice;
  document.documentElement.classList.toggle("dark", resolved === "dark");
  return resolved;
};

export const useTheme = () => {
  const [choice, setChoice] = useState<ThemeChoice>(readStoredTheme);
  const [resolved, setResolved] = useState<"light" | "dark">(() => applyTheme(readStoredTheme()));

  useEffect(() => {
    setResolved(applyTheme(choice));
    try {
      if (choice === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      // Not being able to remember the choice shouldn't stop it applying now.
    }
  }, [choice]);

  // Follow the OS while the reader hasn't picked a side.
  useEffect(() => {
    if (choice !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setResolved(applyTheme("system"));
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [choice]);

  const cycle = useCallback(() => {
    setChoice((prev) => (prev === "system" ? "light" : prev === "light" ? "dark" : "system"));
  }, []);

  return { choice, resolved, setChoice, cycle };
};
