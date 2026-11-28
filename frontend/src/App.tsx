import { useEffect, useState } from "react";
import "@fontsource-variable/inter";
import Accounts from "./Accounts";
import Budgets from "./Budgets";
import BusinessReports from "./BusinessReports";
import Overview from "./Overview";
import { useSavedAccounts } from "./useSavedAccounts";
import AuthGate from "./AuthGate";
import { authRequest, readUser, type AuthUser } from "./auth";
import Plans from "./Plans";
import { describePlan } from "./planPresentation";
import SavingsGoals from "./SavingsGoals";
import Settings from "./Settings";
import Transactions from "./Transactions";
import logo from "./assets/auth/finclear-logo.png";
import accountsIcon from "./assets/navigation/accounts.svg";
import activityIcon from "./assets/navigation/activity.svg";
import budgetIcon from "./assets/navigation/budget.svg";
import collapseIcon from "./assets/navigation/collapse.svg";
import helpIcon from "./assets/navigation/help.svg";
import notificationsIcon from "./assets/navigation/notifications.svg";
import overviewIcon from "./assets/navigation/overview.svg";
import reportsIcon from "./assets/navigation/reports.svg";
import searchIcon from "./assets/navigation/search.svg";
import settingsIcon from "./assets/navigation/settings.svg";

const labels = {
  dashboard: "Overview",
  budgets: "Budget",
  transactions: "Activity",
  accounts: "Accounts",
  reports: "Business reports",
  settings: "Settings",
  savings: "Savings Goals",
  plans: "Plans & billing",
} as const;

type Page = keyof typeof labels;
type NavigationPage = Exclude<Page, "savings" | "plans">;
type Panel = "search" | "notifications" | "profile" | "help";
type Theme = "dark" | "light" | "system";

const icons: Record<NavigationPage, string> = {
  dashboard: overviewIcon,
  budgets: budgetIcon,
  transactions: activityIcon,
  accounts: accountsIcon,
  reports: reportsIcon,
  settings: settingsIcon,
};

const desktopPages: NavigationPage[] = [
  "dashboard", "budgets", "transactions", "accounts", "reports",
];

const mobilePages: NavigationPage[] = [
  "dashboard", "budgets", "transactions", "accounts", "settings",
];

const defaultSettingsSection = "Profile & Account";
const systemThemeQuery = "(prefers-color-scheme: dark)";

function loadTheme(): Theme {
  try {
    const raw = localStorage.getItem("finclear-appearance");
    const saved: { theme?: unknown } | null = raw ? JSON.parse(raw) : null;

    if (saved?.theme === "light" || saved?.theme === "system") {
      return saved.theme;
    }
  } catch {
    // Fall back to dark mode if the preference cannot be read.
  }

  return "dark";
}

const styles = `
  .fc-shell {
    --fc-background: #0b1512;
    --fc-sidebar: #0f1c17;
    --fc-surface: #12221c;
    --fc-input: #0f201a;
    --fc-border: #263c31;
    --fc-text: #eafaf0;
    --fc-muted: #9bb0a3;
    --fc-accent: #61d98f;
    --fc-selected: #163d2a;
    --fc-subtle: #172a22;
    --fc-on-accent: #0b1512;
    --fc-warning-surface: #2a2418;
    --fc-warning: #ffbc68;
    --fc-error: #ffa5a5;
    --fc-color-scheme: dark;
    --fc-avatar-background: #173529;
    --fc-mobile-active-background: #60d68a;
    --fc-mobile-active-text: #0b1512;

    display: flex;
    align-items: flex-start;
    min-height: 100vh;
    width: 100%;
    background: var(--fc-background);
    color: var(--fc-text);
    color-scheme: var(--fc-color-scheme);
    font-family: "Inter Variable", Inter, sans-serif;
    text-align: left;
  }

  .fc-shell[data-theme="light"] {
    --fc-background: #f1f7f3;
    --fc-sidebar: #f7faf8;
    --fc-surface: #f7faf8;
    --fc-input: #f2f6f4;
    --fc-border: #dce6df;
    --fc-text: #0f2b45;
    --fc-muted: #526660;
    --fc-accent: #217a43;
    --fc-selected: #eaf6ee;
    --fc-subtle: #d8e7e1;
    --fc-on-accent: #ffffff;
    --fc-warning-surface: #fff4df;
    --fc-warning: #85500b;
    --fc-error: #a52828;
    --fc-color-scheme: light;
    --fc-avatar-background: #d8e7e1;
    --fc-mobile-active-background: #eaf6ee;
    --fc-mobile-active-text: #217a43;
  }

  .fc-shell[data-theme="light"] :is(.fc-sidebar, .fc-topbar, .fc-nav-mobile) .fc-icon {
    filter: brightness(0.52);
  }

  .fc-sidebar {
    position: sticky;
    top: 0;
    box-sizing: border-box;
    display: flex;
    flex: 0 0 224px;
    flex-direction: column;
    gap: 28px;
    height: 100vh;
    height: 100dvh;
    padding: 32px 16px 20px;
    overflow-y: auto;
    border-right: 1px solid var(--fc-border);
    background: var(--fc-sidebar);
  }

  .fc-brand-row, .fc-brand {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .fc-brand-row { flex: 0 0 40px; }

  .fc-brand {
    flex: 1;
    min-width: 0;
    font-size: 23px;
    line-height: 1.45;
  }

  .fc-brand img { width: 28px; height: 32px; object-fit: contain; }
  .fc-icon { display: block; flex-shrink: 0; }
  .fc-navigation { display: grid; gap: 6px; }
  .fc-nav-mobile { display: none; }

  .fc-shell .fc-control {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 40px;
    padding: 8px 10px;
    border: 1px solid var(--fc-border);
    border-radius: 8px;
    background: var(--fc-surface);
    color: var(--fc-text);
    cursor: pointer;
    font: inherit;
    font-size: 13px;
    text-decoration: none;
  }

  .fc-shell .fc-icon-button {
    flex-shrink: 0;
    width: 40px;
    min-height: 40px;
    padding: 0;
  }

  .fc-shell .fc-topbar-tools .fc-icon-button,
  .fc-shell .fc-profile-row .fc-icon-button {
    border-color: transparent;
    background: transparent;
  }

  .fc-shell .fc-nav-button {
    justify-content: flex-start;
    gap: 12px;
    min-height: 44px;
    width: 100%;
    padding: 0 12px;
    border-color: transparent;
    background: transparent;
    color: var(--fc-muted);
    text-align: left;
  }

  .fc-shell .fc-nav-button[aria-current="page"] {
    background: var(--fc-selected);
    color: var(--fc-accent);
    font-weight: 600;
  }

  .fc-shell .fc-control:hover { border-color: var(--fc-accent); }

  .fc-shell .fc-control:focus-visible,
  .fc-shell input:focus-visible,
  .fc-shell a:focus-visible {
    outline: 2px solid var(--fc-accent);
    outline-offset: 2px;
  }

  .fc-sidebar-footer {
    display: grid;
    gap: 28px;
    margin-top: auto;
  }

  .fc-shell .fc-plan-link {
    display: grid;
    justify-content: start;
    gap: 10px;
    padding: 13px;
    border-color: transparent;
    text-align: left;
  }

  .fc-plan-link small { color: var(--fc-accent); }

  .fc-plan-badge {
    justify-self: start;
    padding: 4px 6px;
    border-radius: 4px;
    background: var(--fc-selected);
    color: var(--fc-accent);
    font-size: 10px;
    font-weight: 600;
    line-height: 16px;
  }

  .fc-plan-link .fc-plan-description { color: var(--fc-muted); font-size: 12px; font-weight: 400; line-height: 17px; }
  .fc-plan-link .fc-plan-action { font-size: 12px; font-weight: 600; line-height: 17px; }
  .fc-profile-details { display: grid; gap: 3px; font-size: 11px; line-height: 16px; }
  .fc-profile-details strong { font-size: 13px; font-weight: 600; line-height: 19px; }
  .fc-profile-details small { color: var(--fc-muted); font-size: inherit; }

  .fc-profile-row {
    display: flex;
    align-items: center;
    gap: 4px;
    padding-top: 28px;
    border-top: 1px solid var(--fc-border);
  }

  .fc-shell .fc-profile-button {
    flex: 1;
    justify-content: flex-start;
    gap: 8px;
    min-width: 0;
    padding-inline: 4px;
    border-color: transparent;
    background: transparent;
    text-align: left;
  }

  .fc-avatar {
    display: grid;
    flex: 0 0 32px;
    height: 32px;
    place-items: center;
    border-radius: 50%;
    background: var(--fc-avatar-background);
    color: var(--fc-accent);
    font-weight: 600;
  }

  .fc-collapsed .fc-sidebar { flex-basis: 72px; padding-inline: 8px; }
  .fc-collapsed .fc-brand-row { justify-content: center; }

  .fc-collapsed .fc-brand,
  .fc-collapsed .fc-sidebar .fc-long-label { display: none; }

  .fc-collapsed .fc-collapse-icon { transform: rotate(180deg); }
  .fc-short-label { display: none; }
  .fc-collapsed .fc-short-label { display: inline; }

  .fc-collapsed .fc-sidebar .fc-nav-button,
  .fc-collapsed .fc-profile-button {
    justify-content: center;
    padding-inline: 4px;
  }

  .fc-collapsed .fc-profile-row { flex-direction: column; }

  .fc-collapsed .fc-sidebar .fc-plan-link {
    justify-content: center;
    padding-inline: 4px;
  }

  .fc-main { flex: 1; min-width: 0; }

  .fc-topbar {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 72px;
    gap: 16px;
    padding: 0 40px;
    border-bottom: 1px solid var(--fc-border);
    color: var(--fc-muted);
    font-size: 12px;
  }

  .fc-breadcrumb {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 8px;
  }

  .fc-breadcrumb strong { color: var(--fc-text); font-weight: 500; }
  .fc-breadcrumb .fc-mobile-crumb { display: none; }
  .fc-topbar-tools { display: flex; align-items: center; gap: 2px; }
  .fc-topbar-tools > span { margin-right: 8px; white-space: nowrap; }
  .fc-main .fc-overview-topbar { display: none; }

  .fc-panel {
    display: grid;
    gap: 12px;
    margin: 16px 40px;
    padding: 20px;
    border: 1px solid var(--fc-border);
    border-radius: 12px;
    background: var(--fc-surface);
  }

  .fc-panel h2, .fc-panel p { margin: 0; }
  .fc-panel p { color: var(--fc-muted); }
  .fc-panel-actions { display: flex; flex-wrap: wrap; gap: 8px; }

  .fc-panel input {
    box-sizing: border-box;
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--fc-border);
    border-radius: 8px;
    background: var(--fc-background);
    color: var(--fc-text);
    font: inherit;
  }

  @media (max-width: 700px) {
    .fc-shell { display: block; }
    .fc-sidebar { display: none; }
    .fc-main { padding-bottom: calc(72px + env(safe-area-inset-bottom)); }
    .fc-topbar { min-height: 64px; padding: 8px 16px; }

    .fc-breadcrumb .fc-desktop-crumb,
    .fc-topbar-tools > span { display: none; }

    .fc-breadcrumb .fc-mobile-crumb { display: inline; font-size: 18px; }
    .fc-panel { margin: 16px; }

    .fc-nav-mobile {
      position: fixed;
      z-index: 20;
      right: 0;
      bottom: 0;
      left: 0;
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 0;
      padding: 12px 0 calc(12px + env(safe-area-inset-bottom));
      background: var(--fc-surface);
    }

    .fc-nav-mobile .fc-nav-button {
      flex-direction: column;
      justify-content: center;
      gap: 2px;
      min-height: 48px;
      padding: 4px 2px;
      border-radius: 12px;
      color: var(--fc-accent);
      font-size: 11px;
      text-align: center;
    }

    .fc-nav-mobile .fc-nav-button[aria-current="page"] {
      background: var(--fc-mobile-active-background);
      color: var(--fc-mobile-active-text);
    }

    .fc-nav-mobile .fc-nav-button[aria-current="page"] .fc-icon {
      filter: brightness(0.25);
    }
  }
`;

function Workspace({ user, logout, onAccountDeleted, onSessionEnded, onPasswordChanged }: {
  user: AuthUser; logout: () => Promise<void>; onAccountDeleted: (message: string) => void;
  onSessionEnded: (message: string) => void; onPasswordChanged: () => void;
}) {
  const [planAccount, setPlanAccount] = useState(user);
  const [planRefreshing, setPlanRefreshing] = useState(false);
  const [planError, setPlanError] = useState("");
  const planStatus = describePlan(planAccount);
  const viewer = { firstName: user.firstName, role: planAccount.role, trialEndsAt: planAccount.trialEndsAt?.slice(0, 10) ?? null };
  const [page, setPage] = useState<Page>("dashboard");
  const [createBudgetOnOpen, setCreateBudgetOnOpen] = useState(false);
  const [budgetEditorMode, setBudgetEditorMode] = useState<"create" | "edit" | "replace" | null>(null);
  const [connectAccountOnOpen, setConnectAccountOnOpen] = useState(false);
  const savedAccounts = useSavedAccounts();
  const [settingsSection, setSettingsSection] = useState(defaultSettingsSection);
  const [collapsed, setCollapsed] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia(systemThemeQuery).matches,
  );
  const [logoutError, setLogoutError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  async function signOut() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError("");
    try { await logout(); }
    catch { setLogoutError("Unable to log out. Please try again."); }
    finally { setLoggingOut(false); }
  }

  useEffect(() => {
    const preference = window.matchMedia(systemThemeQuery);

    function updateSystemTheme(event: MediaQueryListEvent) {
      setSystemDark(event.matches);
    }

    preference.addEventListener("change", updateSystemTheme);
    return () => preference.removeEventListener("change", updateSystemTheme);
  }, []);

  function navigate(next: Page) {
    setCreateBudgetOnOpen(false);
    setBudgetEditorMode(null);
    setConnectAccountOnOpen(false);
    savedAccounts.reload();
    if (next === "settings" && page !== "settings") {
      setSettingsSection(defaultSettingsSection);
    }

    setPage(next);
    setPanel(null);
    window.scrollTo({ top: 0 });
  }

  async function refreshPlan() {
    if (planRefreshing) return;
    setPlanRefreshing(true);
    setPlanError("");
    try {
      const current = await readUser(await authRequest("me"));
      if (current.id !== user.id) throw new Error("Your signed-in account changed. Reload FinClear before continuing.");
      setPlanAccount(current);
    } catch (cause) {
      setPlanError(cause instanceof Error ? cause.message : "Unable to refresh your plan status. Please try again.");
    } finally { setPlanRefreshing(false); }
  }

  function openSubscription() {
    navigate("settings");
    setSettingsSection("Subscription");
  }

  function togglePanel(next: Panel) {
    setQuery("");
    setPanel((current) => (current === next ? null : next));
  }

  const searchQuery = query.trim().toLowerCase();
  const matchingPages = (Object.keys(labels) as Page[]).filter((item) =>
    labels[item].toLowerCase().includes(searchQuery),
  );

  const activeMobilePage =
    page === "reports" || page === "savings" || page === "plans" ? "settings" : page;
  const workspace =
    page === "reports" ? `${viewer.firstName}’s workspace` : "Personal workspace";
  const collapseLabel = collapsed ? "Expand sidebar" : "Collapse sidebar";
  const appliedTheme = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  return (
    <div
      className={`fc-shell${collapsed ? " fc-collapsed" : ""}`}
      data-theme={appliedTheme}
    >
      <style>{styles}</style>

      <aside className="fc-sidebar">
        <div className="fc-brand-row">
          <div className="fc-brand">
            <img src={logo} alt="" />
            <span>FinClear</span>
          </div>

          <button
            type="button"
            className="fc-control fc-icon-button"
            aria-label={collapseLabel}
            title={collapseLabel}
            aria-expanded={!collapsed}
            aria-controls="fc-desktop-navigation"
            onClick={() => setCollapsed((value) => !value)}
          >
            <img className="fc-icon fc-collapse-icon" src={collapseIcon} alt="" />
          </button>
        </div>

        <nav id="fc-desktop-navigation" className="fc-navigation" aria-label="Main navigation">
          {desktopPages.map((item) => (
            <button
              key={item}
              type="button"
              className="fc-control fc-nav-button"
              aria-label={labels[item]}
              aria-current={page === item ? "page" : undefined}
              title={labels[item]}
              onClick={() => navigate(item)}
            >
              <img className="fc-icon" src={icons[item]} alt="" />
              <span className="fc-long-label">{labels[item]}</span>
            </button>
          ))}
        </nav>

        <div className="fc-sidebar-footer">
          <button
            type="button"
            className="fc-control fc-plan-link"
            aria-label="Subscription"
            aria-current={page === "plans" ? "page" : undefined}
            onClick={() => navigate("plans")}
          >
            <span className="fc-long-label fc-plan-badge">{planStatus.badge}</span>
            <span className="fc-long-label fc-plan-description">{planStatus.sidebar}</span>
            <small className="fc-long-label fc-plan-action">View plans →</small>
            <span className="fc-short-label" aria-hidden="true">Plan</span>
          </button>

          <button
            type="button"
            className="fc-control fc-nav-button"
            aria-label="Help and support"
            title="Help and support"
            aria-expanded={panel === "help"}
            onClick={() => togglePanel("help")}
          >
            <img className="fc-icon" src={helpIcon} alt="" />
            <span className="fc-long-label">Help &amp; support</span>
          </button>

          <div className="fc-profile-row">
            <button
              type="button"
              className="fc-control fc-profile-button"
              aria-label="Profile menu"
              aria-expanded={panel === "profile"}
              onClick={() => togglePanel("profile")}
            >
              <span className="fc-avatar" aria-hidden="true">{viewer.firstName.charAt(0).toUpperCase()}</span>
              <span className="fc-long-label fc-profile-details"><strong>{viewer.firstName}</strong><small>Personal account</small></span>
            </button>

            <button
              type="button"
              className="fc-control fc-icon-button"
              aria-label="Settings"
              title="Settings"
              aria-current={page === "settings" ? "page" : undefined}
              onClick={() => navigate("settings")}
            >
              <img className="fc-icon" src={settingsIcon} alt="" />
            </button>
          </div>
        </div>
      </aside>

      <main className="fc-main">
        <header className="fc-topbar">
          <nav className="fc-breadcrumb" aria-label="Breadcrumb">
            <span className="fc-desktop-crumb">{workspace}</span>
            <span className="fc-desktop-crumb" aria-hidden="true">/</span>

            {page === "settings" && (
              <>
                <span className="fc-desktop-crumb">Settings</span>
                <span className="fc-desktop-crumb" aria-hidden="true">/</span>
              </>
            )}

            <strong className="fc-desktop-crumb" aria-current="page">
              {page === "settings" ? settingsSection : labels[page]}
            </strong>

            {page === "budgets" && budgetEditorMode && <>
              <span className="fc-desktop-crumb" aria-hidden="true">/</span>
              <span className="fc-desktop-crumb">{budgetEditorMode === "edit" ? "Edit plan" : budgetEditorMode === "replace" ? "Replace plan" : "Create plan"}</span>
            </>}

            <strong className="fc-mobile-crumb" aria-current="page">
              {labels[page]}
            </strong>
          </nav>

          <div className="fc-topbar-tools">
            <span>{page === "accounts" ? "Balances shown in account currency" : page === "reports" ? "Amounts shown in report currency" : "All amounts in CAD"}</span>

            <button
              type="button"
              className="fc-control fc-icon-button"
              aria-label="Search"
              title="Search"
              aria-expanded={panel === "search"}
              onClick={() => togglePanel("search")}
            >
              <img className="fc-icon" src={searchIcon} alt="" />
            </button>

            <button
              type="button"
              className="fc-control fc-icon-button"
              aria-label="Notifications"
              title="Notifications"
              aria-expanded={panel === "notifications"}
              onClick={() => togglePanel("notifications")}
            >
              <img className="fc-icon" src={notificationsIcon} alt="" />
            </button>
          </div>
        </header>

        {panel && (
          <section className="fc-panel" aria-label="Workspace tools">
            <div className="fc-panel-actions">
              <button type="button" className="fc-control" onClick={() => setPanel(null)}>
                Close
              </button>
            </div>

            {panel === "search" && (
              <>
                <h2>Search pages</h2>
                <input
                  type="search"
                  aria-label="Search pages"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <div className="fc-panel-actions">
                  {matchingPages.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className="fc-control"
                      onClick={() => navigate(item)}
                    >
                      {labels[item]}
                    </button>
                  ))}
                  {matchingPages.length === 0 && <p>No matching pages.</p>}
                </div>
              </>
            )}

            {panel === "notifications" && (
              <>
                <h2>Notifications</h2>
                <p>No notifications in this preview.</p>
              </>
            )}

            {panel === "profile" && (
              <>
                <h2>{viewer.firstName}’s account</h2>
                <p>{user.email}</p>
                <div className="fc-panel-actions">
                  <button type="button" className="fc-control" onClick={() => navigate("settings")}>
                    Settings
                  </button>
                  <button type="button" className="fc-control" onClick={() => navigate("savings")}>
                    Savings Goals
                  </button>
                  <button type="button" className="fc-control" onClick={() => void signOut()} disabled={loggingOut}>
                    {loggingOut ? "Logging out…" : "Log out"}
                  </button>
                  {logoutError && <p role="alert">{logoutError}</p>}
                </div>
              </>
            )}

            {panel === "help" && (
              <>
                <h2>Help &amp; support</h2>
                <p>The help centre is pending.</p>
              </>
            )}
          </section>
        )}

        {page === "dashboard" && (
          <Overview
            onViewActivity={() => navigate("transactions")}
            onReviewBudget={() => navigate("budgets")}
          />
        )}
        {page === "budgets" && <Budgets onEditorModeChange={setBudgetEditorMode} userId={user.id} initialCreate={createBudgetOnOpen} onConnectAccount={() => navigate("accounts")} />}
        {page === "transactions" && <Transactions userId={user.id} hasLinkedAccounts={savedAccounts.accounts.length > 0} onViewAccounts={() => navigate("accounts")} />}
        {page === "accounts" && <Accounts connectOnOpen={connectAccountOnOpen} />}
        {page === "reports" && <BusinessReports onViewBudget={() => navigate("budgets")} onViewAccounts={() => navigate("accounts")} hasLinkedAccounts={savedAccounts.accounts.length > 0} accountsLoading={savedAccounts.loading} accountsError={savedAccounts.error} onRetryAccounts={savedAccounts.reload} />}
        {page === "savings" && <SavingsGoals />}
        {page === "plans" && <Plans account={planAccount} refreshing={planRefreshing} refreshError={planError} onRefresh={() => void refreshPlan()} onBack={openSubscription} onContinue={() => navigate("dashboard")} />}
        {page === "settings" && (
          <Settings
            user={planAccount}
            onAccountDeleted={onAccountDeleted}
            onSessionEnded={onSessionEnded}
            onPasswordChanged={onPasswordChanged}
            initialSection={settingsSection === "Subscription" ? "subscription" : "profile"}
            onViewPlans={() => navigate("plans")}
            onLogout={() => void signOut()}
            loggingOut={loggingOut}
            logoutError={logoutError}
            onSectionChange={setSettingsSection}
            onViewAccounts={() => navigate("accounts")}
            onThemeChange={setTheme}
          />
        )}
      </main>

      <nav className="fc-navigation fc-nav-mobile" aria-label="Mobile navigation">
        {mobilePages.map((item) => (
          <button
            key={item}
            type="button"
            className="fc-control fc-nav-button"
            aria-current={activeMobilePage === item ? "page" : undefined}
            onClick={() => navigate(item)}
          >
            <img className="fc-icon" src={icons[item]} alt="" />
            {item === "dashboard" ? "Home" : labels[item]}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  return <AuthGate component={Workspace} />;
}
