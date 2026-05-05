"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Settings2, Save, RotateCcw, Palette, Thermometer, FolderOpen, Clock, Zap } from "lucide-react";
import {
  loadUserPreferences,
  saveUserPreferences,
  resetUserPreferences,
  type UserPreferences,
} from "@/lib/user-preferences";

interface Props {
  onSave?: (preferences: UserPreferences) => void;
}

export default function UserPreferencesPanel({ onSave }: Props) {
  const [preferences, setPreferences] = useState<UserPreferences>(loadUserPreferences());
  const [saved, setSaved] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleChange = <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    saveUserPreferences(preferences);
    setSaved(true);
    onSave?.(preferences);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = () => {
    if (confirm("Reset all preferences to default?")) {
      resetUserPreferences();
      setPreferences(loadUserPreferences());
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#f1f5f9] tracking-tight flex items-center gap-2">
          <Settings2 size={16} className="text-[#8b5cf6]" />
          User Preferences
        </h2>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-xs px-2 py-1 rounded-full transition-all"
          style={{
            backgroundColor: isOpen ? "#8b5cf620" : "#111827",
            color: isOpen ? "#8b5cf6" : "#94a3b8",
            border: `1px solid ${isOpen ? "#8b5cf640" : "#2a3654"}`,
          }}
        >
          {isOpen ? "Close" : "Edit"}
        </button>
      </div>

      {!isOpen && (
        <div className="text-xs text-[#475569] space-y-1">
          <div>
            <span className="text-[#94a3b8]">Theme:</span> {preferences.theme}
          </div>
          <div>
            <span className="text-[#94a3b8]">Temperature:</span> {preferences.temperatureUnit}
          </div>
          <div>
            <span className="text-[#94a3b8]">Auto-save:</span> {preferences.autoSaveResults ? "ON" : "OFF"}
          </div>
        </div>
      )}

      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="flex flex-col gap-4 overflow-hidden"
        >
          {/* Display Settings */}
          <Section icon={<Palette size={14} />} title="Display">
            <SelectField
              label="Theme"
              value={preferences.theme}
              options={[
                { value: "dark", label: "Dark" },
                { value: "light", label: "Light" },
                { value: "auto", label: "Auto" },
              ]}
              onChange={(v) => handleChange("theme", v as "dark" | "light" | "auto")}
            />
            <ToggleField
              label="Compact Mode"
              description="Reduce spacing and padding"
              checked={preferences.compactMode}
              onChange={(v) => handleChange("compactMode", v)}
            />
            <ToggleField
              label="Show Mock Data Warning"
              description="Display warning when using simulated data"
              checked={preferences.showMockDataWarning}
              onChange={(v) => handleChange("showMockDataWarning", v)}
            />
            <ToggleField
              label="Animations"
              description="Enable UI animations"
              checked={preferences.animationsEnabled}
              onChange={(v) => handleChange("animationsEnabled", v)}
            />
          </Section>

          {/* Units */}
          <Section icon={<Thermometer size={14} />} title="Units">
            <SelectField
              label="Temperature Unit"
              value={preferences.temperatureUnit}
              options={[
                { value: "celsius", label: "Celsius (°C)" },
                { value: "fahrenheit", label: "Fahrenheit (°F)" },
              ]}
              onChange={(v) => handleChange("temperatureUnit", v as "celsius" | "fahrenheit")}
            />
          </Section>

          {/* Auto-save */}
          <Section icon={<FolderOpen size={14} />} title="Auto-save">
            <ToggleField
              label="Auto-save Results"
              description="Automatically save test results"
              checked={preferences.autoSaveResults}
              onChange={(v) => handleChange("autoSaveResults", v)}
            />
            <InputField
              label="Export Path"
              value={preferences.autoExportPath}
              onChange={(v) => handleChange("autoExportPath", v)}
              placeholder="C:\Users\...\Documents"
            />
          </Section>

          {/* Test Defaults */}
          <Section icon={<Clock size={14} />} title="Test Defaults">
            <NumberField
              label="Default Test Duration (seconds)"
              value={preferences.defaultTestDuration}
              onChange={(v) => handleChange("defaultTestDuration", v)}
              min={60}
              max={3600}
              step={60}
            />
            <ToggleField
              label="Auto-start Monitoring"
              description="Start monitoring when app opens"
              checked={preferences.autoStartMonitoring}
              onChange={(v) => handleChange("autoStartMonitoring", v)}
            />
          </Section>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <motion.button
              onClick={handleSave}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all"
              style={{
                background: saved ? "#22c55e20" : "linear-gradient(135deg, #8b5cf6, #a855f7)",
                color: saved ? "#22c55e" : "#fff",
                border: saved ? "1px solid #22c55e40" : "none",
              }}
            >
              <Save size={12} />
              {saved ? "Saved!" : "Save Preferences"}
            </motion.button>
            <motion.button
              onClick={handleReset}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
              style={{
                backgroundColor: "#111827",
                color: "#94a3b8",
                border: "1px solid #2a3654",
              }}
            >
              <RotateCcw size={12} />
              Reset
            </motion.button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-xs text-[#94a3b8] font-medium">
        {icon}
        <span>{title}</span>
      </div>
      <div className="flex flex-col gap-2 pl-5">
        {children}
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-[#94a3b8]">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 rounded-lg text-xs text-[#f1f5f9] bg-[#111827] border border-[#2a3654] focus:border-[#8b5cf6] focus:outline-none transition-all"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ToggleField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div
      className="flex items-center justify-between p-2 rounded-lg bg-[#111827] cursor-pointer"
      onClick={() => onChange(!checked)}
    >
      <div>
        <p className="text-xs text-[#f1f5f9] font-medium">{label}</p>
        <p className="text-xs text-[#475569]">{description}</p>
      </div>
      <div
        className="w-9 h-5 rounded-full transition-colors relative flex-shrink-0"
        style={{ backgroundColor: checked ? "#8b5cf6" : "#475569" }}
      >
        <div
          className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
          style={{
            transform: checked ? "translateX(18px)" : "translateX(2px)",
          }}
        />
      </div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-[#94a3b8]">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="px-3 py-2 rounded-lg text-xs text-[#f1f5f9] bg-[#111827] border border-[#2a3654] focus:border-[#8b5cf6] focus:outline-none transition-all placeholder:text-[#475569]"
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-[#94a3b8]">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="px-3 py-2 rounded-lg text-xs text-[#f1f5f9] bg-[#111827] border border-[#2a3654] focus:border-[#8b5cf6] focus:outline-none transition-all"
      />
    </div>
  );
}
