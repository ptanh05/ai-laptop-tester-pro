export interface UserPreferences {
  // Display
  theme: "dark" | "light" | "auto";
  compactMode: boolean;
  showMockDataWarning: boolean;

  // Units
  temperatureUnit: "celsius" | "fahrenheit";

  // Auto-save
  autoSaveResults: boolean;
  autoExportPath: string;

  // Test defaults
  defaultTestDuration: number; // seconds
  autoStartMonitoring: boolean;

  // UI
  animationsEnabled: boolean;
  soundEnabled: boolean;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "dark",
  compactMode: false,
  showMockDataWarning: true,
  temperatureUnit: "celsius",
  autoSaveResults: true,
  autoExportPath: "C:\\Users\\anh01\\Documents\\AI-Laptop-Tester",
  defaultTestDuration: 900,
  autoStartMonitoring: true,
  animationsEnabled: true,
  soundEnabled: false,
};

const STORAGE_KEY = "ai-laptop-tester-preferences";

export function loadUserPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const stored = JSON.parse(raw);
      return { ...DEFAULT_PREFERENCES, ...stored };
    }
  } catch (e) {
    console.error("Failed to load preferences:", e);
  }
  return { ...DEFAULT_PREFERENCES };
}

export function saveUserPreferences(preferences: UserPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch (e) {
    console.error("Failed to save preferences:", e);
  }
}

export function resetUserPreferences(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error("Failed to reset preferences:", e);
  }
}

export function convertTemperature(celsius: number, unit: "celsius" | "fahrenheit"): number {
  if (unit === "fahrenheit") {
    return (celsius * 9) / 5 + 32;
  }
  return celsius;
}

export function formatTemperature(celsius: number, unit: "celsius" | "fahrenheit"): string {
  const value = convertTemperature(celsius, unit);
  const symbol = unit === "celsius" ? "°C" : "°F";
  return `${value.toFixed(1)}${symbol}`;
}
