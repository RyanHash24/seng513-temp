import { useEffect, useState, type FormEvent } from "react";
import Appearance from "./Appearance";
import DataPrivacy from "./DataPrivacy";
import SecuritySettings from "./SecuritySettings";
import PlaidTestPanel from "./PlaidTestPanel";
import { SubscriptionPlans } from "./PlanStatus";
import type { AuthUser } from "./auth";
import "./Settings.css";

type SettingsData = {
  name: string;
  email: string;
  currency: string;
  notifications: boolean;
  budgetAlerts: boolean;
  savingsReminders: boolean;
};

type SettingsProps = {
  user: AuthUser;
  onLogout: () => void;
  loggingOut?: boolean;
  logoutError?: string;
  onSectionChange?: (label: string) => void;
  onViewAccounts?: () => void;
  onThemeChange?: (theme: "dark" | "light" | "system") => void;
  onViewPlans?: () => void;
  onAccountDeleted: (message: string) => void;
  onSessionEnded: (message: string) => void;
  onPasswordChanged: () => void;
  initialSection?: "profile" | "subscription";
};


const defaults: SettingsData = {
  name: "FinClear User",
  email: "",
  currency: "CAD",
  notifications: true,
  budgetAlerts: true,
  savingsReminders: true,
};

const sections = {
  profile: ["Profile & Account", "Manage the personal details for your workspace."],
  security: ["Security", "Manage how you sign in and protect your account."],
  accounts: ["Connected Accounts", "Manage the accounts linked to your workspace."],
  notifications: ["Notifications", "Choose which financial updates you want to receive."],
  budget: ["Budget Preferences", "Set your preferred currency for budgeting."],
  appearance: ["Appearance", "Set your theme and the details that feel familiar."],
  subscription: ["Subscription", "View and manage your FinClear plan."],
  privacy: ["Data & Privacy", "Manage your data and privacy preferences."],
  logout: ["Log out", "Sign out of FinClear on this device."],
} as const;

type Section = keyof typeof sections;
type EditableSection = "profile" | "notifications" | "budget";

const sectionOrder = Object.keys(sections) as Section[];

const currencies = [
  ["CAD", "Canadian Dollar"],
  ["USD", "US Dollar"],
  ["GBP", "British Pound"],
  ["EUR", "Euro"],
  ["TZS", "Tanzanian Shilling"],
];

const notificationOptions = [
  {
    key: "notifications",
    label: "Enable notifications",
    description: "Allow financial notifications in FinClear.",
  },
  {
    key: "budgetAlerts",
    label: "Budget alerts",
    description: "Receive an alert when you approach a budget limit.",
  },
  {
    key: "savingsReminders",
    label: "Savings reminders",
    description: "Receive reminders about your savings goals.",
  },
] as const;

const styles = `
  .fc-settings {
    --settings-surface: var(--fc-surface, #12221c);
    --settings-input: var(--fc-input, #0f201a);
    --settings-border: var(--fc-border, #263c31);
    --settings-muted: var(--fc-muted, #9bb0a3);
    --settings-accent: var(--fc-accent, #61d98f);
    --settings-selected: var(--fc-selected, #163d2a);
    display: grid;
    grid-template-columns: 208px minmax(0, 1fr);
    align-items: start;
    gap: 28px;
    padding: 40px;
    color: var(--fc-text, #eafaf0);
    color-scheme: var(--fc-color-scheme, dark);
  }

  .fc-settings * { box-sizing: border-box; }
  .fc-settings :is(h1, h2, p) { margin: 0; }
  .fc-settings-nav { display: grid; gap: 4px; }

  .fc-settings button {
    min-height: 40px;
    padding: 8px 14px;
    border: 1px solid var(--settings-border);
    border-radius: 8px;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }

  .fc-settings-nav button {
    min-height: 42px;
    border-color: transparent;
    color: var(--settings-muted);
    text-align: left;
  }

  .fc-settings-nav button[aria-current="true"] {
    background: var(--settings-selected);
    color: var(--settings-accent);
    font-weight: 600;
  }

  .fc-settings button:hover { border-color: var(--settings-accent); }

  .fc-settings :is(button, input, select):focus-visible {
    outline: 2px solid var(--settings-accent);
    outline-offset: 2px;
  }

  .fc-settings-panel {
    min-width: 0;
    padding: 24px;
    border: 1px solid var(--settings-border);
    border-radius: 12px;
    background: var(--settings-surface);
  }

  .fc-settings-panel h1 { font-size: 18px; font-weight: 600; line-height: 1.4; }
  .fc-settings-panel h2 { font-size: 15px; font-weight: 600; }

  .fc-settings .fc-settings-description {
    margin-top: 4px;
    color: var(--settings-muted);
    font-size: 13px;
    line-height: 1.5;
  }

  .fc-settings-body {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid var(--settings-border);
  }

  .fc-settings-profile {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 20px;
  }

  .fc-settings-avatar {
    display: grid;
    flex: 0 0 52px;
    height: 52px;
    place-items: center;
    border-radius: 50%;
    background: var(--settings-selected);
    color: var(--settings-accent);
    font-size: 20px;
    font-weight: 600;
  }

  .fc-settings-fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }

  .fc-settings-fields label {
    display: grid;
    gap: 8px;
    color: var(--settings-muted);
    font-size: 13px;
  }

  .fc-settings-fields :is(input, select) {
    width: 100%;
    min-width: 0;
    min-height: 40px;
    padding: 8px 12px;
    border: 1px solid var(--settings-border);
    border-radius: 8px;
    background: var(--settings-input);
    color: var(--fc-text, #eafaf0);
    font: inherit;
  }

  .fc-settings-option,
  .fc-settings-connection {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 0;
    font-size: 14px;
  }

  .fc-settings-option + .fc-settings-option,
  .fc-settings-connection + .fc-settings-connection {
    border-top: 1px solid var(--settings-border);
  }

  .fc-settings-option small {
    display: block;
    margin-top: 4px;
    color: var(--settings-muted);
    font-size: 13px;
  }

  .fc-settings-option input {
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    accent-color: var(--settings-accent);
  }

  .fc-settings-connections {
    margin: 12px 0 0;
    padding: 0;
    list-style: none;
  }

  .fc-settings-connection { flex-wrap: wrap; }

  .fc-settings-connection-name {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .fc-settings-connection-icon {
    display: grid;
    flex: 0 0 36px;
    height: 36px;
    place-items: center;
    border-radius: 8px;
    background: var(--fc-subtle, #172a22);
  }

  .fc-settings-connection-status {
    padding: 4px 8px;
    border-radius: 6px;
    background: var(--settings-selected);
    color: var(--settings-accent);
    font-size: 12px;
  }

  .fc-settings-connection-warning {
    background: var(--fc-warning-surface, #2a2418);
    color: var(--fc-warning, #ffbc68);
  }

  .fc-settings-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid var(--settings-border);
  }

  .fc-settings .fc-settings-save {
    border-color: var(--settings-accent);
    background: var(--settings-accent);
    color: var(--fc-on-accent, #0b1512);
    font-weight: 600;
  }

  .fc-settings .fc-settings-feedback {
    margin-top: 12px;
    color: var(--settings-accent);
    font-size: 13px;
  }

  .fc-settings .fc-settings-error { color: var(--fc-error, #ffa5a5); }

  @media (max-width: 900px) {
    .fc-settings { grid-template-columns: minmax(0, 1fr); }
    .fc-settings-nav { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }

  @media (max-width: 700px) {
    .fc-settings { gap: 16px; padding: 24px 20px; }
    .fc-settings-panel { padding: 16px; }
    .fc-settings-fields { grid-template-columns: minmax(0, 1fr); }
  }
`;

function loadSettings(storageKey: string, user: AuthUser): SettingsData {
  const initial = { ...defaults, name: [user.firstName, user.lastName].filter(Boolean).join(" "), email: user.email };
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) return { ...initial, ...JSON.parse(raw) };
  } catch (error) {
    console.error("Unable to load settings:", error);
  }

  return initial;
}

function isEditable(section: Section): section is EditableSection {
  return section === "profile" || section === "notifications" || section === "budget";
}

function copySection(
  target: SettingsData,
  source: SettingsData,
  section: EditableSection,
): SettingsData {
  switch (section) {
    case "profile":
      return { ...target, name: source.name, email: source.email };
    case "notifications":
      return {
        ...target,
        notifications: source.notifications,
        budgetAlerts: source.budgetAlerts,
        savingsReminders: source.savingsReminders,
      };
    case "budget":
      return { ...target, currency: source.currency };
  }
}

export default function Settings({
  user,
  onLogout,
  loggingOut = false,
  logoutError = "",
  onSectionChange,
  onViewAccounts,
  onThemeChange,
  onViewPlans,
  onAccountDeleted,
  onSessionEnded,
  onPasswordChanged,
  initialSection = "profile",
}: SettingsProps) {
  const storageKey = `finclear-settings:${user.id}`;
  const [savedSettings, setSavedSettings] = useState(() => loadSettings(storageKey, user));
  const [draft, setDraft] = useState(savedSettings);
  const [section, setSection] = useState<Section>(initialSection);
  const [feedback, setFeedback] = useState<
    { message: string; error: boolean } | null
  >(null);

  const [title, description] = sections[section];
  const displayName = savedSettings.name.trim() || defaults.name;

  useEffect(() => {
    onSectionChange?.(title);
  }, [title, onSectionChange]);

  function updateSetting<Key extends keyof SettingsData>(
    key: Key,
    value: SettingsData[Key],
  ) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setFeedback(null);
  }

  function persistSettings(next: SettingsData) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setSavedSettings(next);
      setFeedback({ message: "Settings saved.", error: false });
      return true;
    } catch {
      setFeedback({ message: "Unable to save settings. Please try again.", error: true });
      return false;
    }
  }

  function changeAppearanceCurrency(currency: string) {
    if (persistSettings({ ...savedSettings, currency })) {
      setDraft((previous) => ({ ...previous, currency }));
    }
  }

  function saveSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isEditable(section)) {
      persistSettings(copySection(savedSettings, draft, section));
    }
  }

  function cancelChanges() {
    if (isEditable(section)) {
      setDraft((previous) => copySection(previous, savedSettings, section));
      setFeedback(null);
    }
  }

  return (
    <div className="fc-settings">
      <style>{styles}</style>

      <nav className="fc-settings-nav" aria-label="Settings sections">
        {sectionOrder.map((item) => (
          <button
            key={item}
            type="button"
            aria-current={section === item ? "true" : undefined}
            onClick={() => {
              setSection(item);
              setFeedback(null);
            }}
          >
            {sections[item][0]}
          </button>
        ))}
      </nav>

      <section className="fc-settings-panel" aria-labelledby="settings-panel-title">
        <header>
          <h1 id="settings-panel-title">{title}</h1>
          <p className="fc-settings-description">{description}</p>
        </header>

        {section === "appearance" && (
          <div className="fc-settings-body">
            <Appearance
              currency={savedSettings.currency}
              onCurrencyChange={changeAppearanceCurrency}
              onThemeChange={(theme) => {
                setFeedback(null);
                onThemeChange?.(theme);
              }}
            />
          </div>
        )}

        {section === "accounts" && (
          <div className="fc-settings-body">
            <PlaidTestPanel />

            {onViewAccounts && (
              <div className="fc-settings-actions">
                <button type="button" className="fc-settings-save" onClick={onViewAccounts}>
                  View accounts
                </button>
              </div>
            )}
          </div>
        )}

        {section === "logout" && (
          <div className="fc-settings-body">
            <p className="fc-settings-description">Signed in as {user.email}.</p>
            <div className="fc-settings-actions">
              <button type="button" className="fc-settings-save" aria-label="Log out of FinClear"
                onClick={onLogout} disabled={loggingOut}>
                {loggingOut ? "Logging out…" : "Log out"}
              </button>
            </div>
            {logoutError && <p className="fc-settings-error" role="alert">{logoutError}</p>}
          </div>
        )}

        {isEditable(section) && (
          <form
            key={section}
            className="fc-settings-body"
            aria-labelledby="settings-panel-title"
            onSubmit={saveSection}
          >
            {section === "profile" && (
              <>
                <div className="fc-settings-profile">
                  <span className="fc-settings-avatar" aria-hidden="true">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <strong>{displayName}</strong>
                    <p className="fc-settings-description">Personal account</p>
                  </div>
                </div>

                <div className="fc-settings-fields">
                  <label>
                    Full name
                    <input
                      type="text"
                      autoComplete="name"
                      value={draft.name}
                      onChange={(event) => updateSetting("name", event.target.value)}
                    />
                  </label>
                  <label>
                    Email address
                    <input
                      type="email"
                      autoComplete="email"
                      value={draft.email}
                      onChange={(event) => updateSetting("email", event.target.value)}
                    />
                  </label>
                </div>
              </>
            )}

            {section === "notifications" &&
              notificationOptions.map(({ key, label, description }) => (
                <label className="fc-settings-option" key={key}>
                  <span>
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={draft[key]}
                    disabled={key !== "notifications" && !draft.notifications}
                    onChange={(event) => updateSetting(key, event.target.checked)}
                  />
                </label>
              ))}

            {section === "budget" && (
              <div className="fc-settings-fields">
                <label>
                  Preferred currency
                  <select
                    value={draft.currency}
                    onChange={(event) => updateSetting("currency", event.target.value)}
                  >
                    {currencies.map(([code, name]) => (
                      <option key={code} value={code}>{code} · {name}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            <div className="fc-settings-actions">
              <button type="button" onClick={cancelChanges}>Cancel</button>
              <button type="submit" className="fc-settings-save">Save changes</button>
            </div>
          </form>
        )}

        {section === "subscription" && <div className="fc-settings-body"><SubscriptionPlans account={user} onViewPlans={onViewPlans} /></div>}

        {section === "privacy" && <DataPrivacy user={user} onDeleted={onAccountDeleted} />}

        {section === "security" && <SecuritySettings onSignedOut={onSessionEnded} onPasswordChanged={onPasswordChanged} />}

        {feedback && (
          <p
            className={`fc-settings-feedback${feedback.error ? " fc-settings-error" : ""}`}
            role={feedback.error ? "alert" : "status"}
          >
            {feedback.message}
          </p>
        )}
      </section>
    </div>
  );
}
