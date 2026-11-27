import { useState } from "react";

type Theme = "dark" | "light" | "system";

type AppearancePreferences = {
  theme: Theme;
  language: string;
  dateFormat: string;
  timeZone: string;
};

type AppearanceProps = {
  currency: string;
  onCurrencyChange: (currency: string) => void;
  onThemeChange?: (theme: Theme) => void;
};

const storageKey = "finclear-appearance";

const themeOptions: { value: Theme; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "Use system" },
];

const currencies = [
  ["CAD", "CAD — Canadian dollar"],
  ["USD", "USD — US dollar"],
  ["GBP", "GBP — British pound"],
  ["EUR", "EUR — Euro"],
  ["TZS", "TZS — Tanzanian shilling"],
] as const;

const preferenceFields = [
  {
    key: "language",
    label: "Language",
    options: [
      ["en-CA", "English (Canada)"],
      ["fr-CA", "Français (Canada)"],
    ],
  },
  {
    key: "dateFormat",
    label: "Date format",
    options: [
      ["medium", "MMM DD, YYYY · Oct 17, 2026"],
      ["iso", "YYYY-MM-DD · 2026-10-17"],
      ["day-first", "DD/MM/YYYY · 17/10/2026"],
    ],
  },
  {
    key: "timeZone",
    label: "Time zone",
    options: [
      ["America/Toronto", "Eastern Time — Toronto"],
      ["America/Edmonton", "Mountain Time — Calgary"],
      ["America/Vancouver", "Pacific Time — Vancouver"],
      ["UTC", "Coordinated Universal Time — UTC"],
    ],
  },
] as const;

const defaults: AppearancePreferences = {
  theme: "dark",
  language: "en-CA",
  dateFormat: "medium",
  timeZone: "America/Toronto",
};

function loadPreferences(): AppearancePreferences {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return defaults;

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaults;

    const saved = parsed as Record<string, unknown>;
    const preferences = { ...defaults };
    const theme = themeOptions.find((option) => option.value === saved.theme);

    if (theme) preferences.theme = theme.value;

    for (const field of preferenceFields) {
      const option = field.options.find(([value]) => value === saved[field.key]);
      if (option) preferences[field.key] = option[0];
    }

    return preferences;
  } catch {
    return defaults;
  }
}

const styles = `
  .fc-appearance {
    --appearance-border: var(--fc-border, #263c31);
    --appearance-surface: var(--fc-input, #0f201a);
    --appearance-text: var(--fc-text, #eafaf0);
    --appearance-muted: var(--fc-muted, #9bb0a3);
    --appearance-accent: var(--fc-accent, #61d98f);
    --appearance-selected: var(--fc-selected, #163d2a);
    display: grid;
    gap: 20px;
    color: var(--appearance-text);
  }

  .fc-appearance fieldset {
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  .fc-appearance legend,
  .fc-appearance-field > span {
    color: var(--appearance-muted);
    font-size: 13px;
  }

  .fc-appearance legend { margin-bottom: 8px; }

  .fc-appearance-themes,
  .fc-appearance-fields {
    display: grid;
    gap: 12px;
  }

  .fc-appearance-themes {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .fc-appearance-theme {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 54px;
    padding: 12px 14px;
    border: 1px solid var(--appearance-border);
    border-radius: 8px;
    background: var(--appearance-surface);
    cursor: pointer;
    font-size: 13px;
  }

  .fc-appearance-theme:has(input:checked) {
    border-color: var(--appearance-accent);
    background: var(--appearance-selected);
    color: var(--appearance-accent);
  }

  .fc-appearance-theme input {
    flex-shrink: 0;
    margin: 0;
    accent-color: var(--appearance-accent);
  }

  .fc-appearance-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }

  .fc-appearance-field {
    display: grid;
    gap: 8px;
    min-width: 0;
  }

  .fc-appearance-field select {
    width: 100%;
    min-width: 0;
    min-height: 40px;
    padding: 8px 12px;
    border: 1px solid var(--appearance-border);
    border-radius: 8px;
    background: var(--appearance-surface);
    color: var(--appearance-text);
    font: inherit;
    font-size: 13px;
  }

  .fc-appearance :is(input, select):focus-visible {
    outline: 2px solid var(--appearance-accent);
    outline-offset: 3px;
  }

  .fc-appearance .fc-appearance-note {
    margin: 0;
    color: var(--appearance-muted);
    font-size: 12px;
    line-height: 1.5;
  }

  .fc-appearance .fc-appearance-error {
    margin: 0;
    color: var(--fc-error, #ffa5a5);
    font-size: 13px;
  }

  @media (max-width: 700px) {
    .fc-appearance-themes,
    .fc-appearance-fields {
      grid-template-columns: minmax(0, 1fr);
    }
  }
`;

export default function Appearance({
  currency,
  onCurrencyChange,
  onThemeChange,
}: AppearanceProps) {
  const [preferences, setPreferences] = useState(loadPreferences);
  const [error, setError] = useState("");

  function updatePreference<Key extends keyof AppearancePreferences>(
    key: Key,
    value: AppearancePreferences[Key],
  ) {
    const next = { ...preferences, [key]: value };

    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      setError("Unable to save this preference on this device.");
      return;
    }

    setPreferences(next);
    setError("");
  }

  function selectTheme(theme: Theme) {
    const next = { ...preferences, theme };

    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      setError("Unable to save this preference on this device.");
      return;
    }

    setPreferences(next);
    setError("");
    onThemeChange?.(theme);
  }

  return (
    <div className="fc-appearance">
      <style>{styles}</style>

      <fieldset>
        <legend>Theme</legend>
        <div className="fc-appearance-themes">
          {themeOptions.map(({ value, label }) => (
            <label className="fc-appearance-theme" key={value}>
              <span>{label}</span>
              <input
                type="radio"
                name="finclear-theme"
                value={value}
                checked={preferences.theme === value}
                onChange={() => selectTheme(value)}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <div className="fc-appearance-fields">
        <label className="fc-appearance-field">
          <span>Currency</span>
          <select
            value={currency}
            onChange={(event) => onCurrencyChange(event.target.value)}
          >
            {currencies.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        {preferenceFields.map(({ key, label, options }) => (
          <label className="fc-appearance-field" key={key}>
            <span>{label}</span>
            <select
              value={preferences[key]}
              onChange={(event) => updatePreference(key, event.target.value)}
            >
              {options.map(([value, text]) => (
                <option key={value} value={value}>{text}</option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <p className="fc-appearance-note">
        Currency is a display preference. Connected account balances keep their original currency.
      </p>

      {error && <p className="fc-appearance-error" role="alert">{error}</p>}
    </div>
  );
}