
import { useState } from "react";
import "./Settings.css";
import type { AuthUser } from "./auth";

type SettingsData = {
  name: string;
  email: string;
  currency: string;
  notifications: boolean;
  budgetAlerts: boolean;
  savingsReminders: boolean;
};

const defaultSettings: SettingsData = {
  name: "FinClear User",
  email: "",
  currency: "CAD",
  notifications: true,
  budgetAlerts: true,
  savingsReminders: true,
};

function loadSettings(user: AuthUser): SettingsData {
  try {
    const saved = localStorage.getItem(`finclear-settings-${user.id}`);

    if (saved) {
      return { ...defaultSettings, ...JSON.parse(saved), name: `${user.firstName} ${user.lastName}`, email: user.email };
    }
  } catch {
    console.error("Unable to load settings");
  }

  return {...defaultSettings,name:`${user.firstName} ${user.lastName}`,email:user.email};
}

function Settings({user}: {user:AuthUser}) {
  const [settings, setSettings] = useState<SettingsData>(
    ()=>loadSettings(user)
  );

  const [saved, setSaved] = useState(false);

  function updateSetting<K extends keyof SettingsData>(
    key: K,
    value: SettingsData[K]
  ) {
    setSettings((previous) => ({
      ...previous,
      [key]: value,
    }));

    setSaved(false);
  }

  function saveSettings() {
    try {
      localStorage.setItem(
        `finclear-settings-${user.id}`,
        JSON.stringify(settings)
      );

      setSaved(true);
    } catch {
      alert("Unable to save settings. Please try again.");
    }
  }

  return (
    <div className="settings-page">
      <h1>Settings</h1>

      <p className="settings-subtitle">
        Manage your account and personalize your FinClear experience.
      </p>

      <section className="settings-card">
        <h2>Profile Information</h2><p>Current plan: {user.role} · Email verified</p>
        <p>Update your personal account details.</p>

        <div className="settings-form">
          <label>
            Full Name
            <input
              type="text"
              value={settings.name}
              onChange={(e) =>
                updateSetting("name", e.target.value)
              }
              placeholder="Enter your name"
            />
          </label>

          <label>
            Email Address
            <input
              type="email"
              value={settings.email}
              onChange={(e) =>
                updateSetting("email", e.target.value)
              }
              placeholder="Enter your email"
            />
          </label>
        </div>
      </section>

      <section className="settings-card">
        <h2>Preferences</h2>
        <p>Customize how FinClear works for you.</p>

        <div className="settings-form">
          <label>
            Preferred Currency
            <select
              value={settings.currency}
              onChange={(e) =>
                updateSetting("currency", e.target.value)
              }
            >
              <option value="CAD">CAD - Canadian Dollar</option>
              <option value="USD">USD - US Dollar</option>
              <option value="GBP">GBP - British Pound</option>
              <option value="EUR">EUR - Euro</option>
              <option value="TZS">TZS - Tanzanian Shilling</option>
            </select>
          </label>
        </div>
      </section>

      <section className="settings-card">
        <h2>Notifications</h2>
        <p>Choose which financial updates you want to receive.</p>

        <div className="settings-toggles">
          <label className="settings-toggle">
            <span>
              <strong>Enable Notifications</strong>
              <small>Allow notifications in FinClear.</small>
            </span>

            <input
              type="checkbox"
              checked={settings.notifications}
              onChange={(e) =>
                updateSetting("notifications", e.target.checked)
              }
            />
          </label>

          <label className="settings-toggle">
            <span>
              <strong>Budget Alerts</strong>
              <small>Enable budget limit alerts.</small>
            </span>

            <input
              type="checkbox"
              checked={settings.budgetAlerts}
              disabled={!settings.notifications}
              onChange={(e) =>
                updateSetting("budgetAlerts", e.target.checked)
              }
            />
          </label>

          <label className="settings-toggle">
            <span>
              <strong>Savings Reminders</strong>
              <small>Enable savings goal reminders.</small>
            </span>

            <input
              type="checkbox"
              checked={settings.savingsReminders}
              disabled={!settings.notifications}
              onChange={(e) =>
                updateSetting("savingsReminders", e.target.checked)
              }
            />
          </label>
        </div>
      </section>

      <div className="settings-actions">
        <button
          className="settings-save"
          onClick={saveSettings}
        >
          Save Changes
        </button>

        {saved && (
          <span className="settings-success">
            Settings saved successfully!
          </span>
        )}
      </div>
    </div>
  );
}

export default Settings;
