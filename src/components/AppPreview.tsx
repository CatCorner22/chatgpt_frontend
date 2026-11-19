import { useState, type CSSProperties } from "react";
import {
  BarChart3,
  Inbox,
  Search,
  Settings,
  LayoutDashboard,
  AlertCircle,
  Loader2,
  Check,
  ArrowRight,
} from "lucide-react";
import { Button } from "./ui/button";
import type { Content, Tokens } from "@/lib/design";
import { signalText, type AppScreen } from "@/lib/appDesign";

// This is a local, interactive design specimen, never connected to customer records.
export function AppPreview({
  t,
  c,
  phone,
  screen,
}: {
  t: Tokens;
  c: Content;
  phone: boolean;
  screen: AppScreen;
}) {
  const [query, setQuery] = useState("");
  const [ascending, setAscending] = useState(true);
  const [retried, setRetried] = useState(false);
  const [created, setCreated] = useState(false);
  const gap = { airy: 28, balanced: 20, compact: 14 }[t.density];
  const heading: CSSProperties = {
    fontFamily: `"${t.headingFont}", serif`,
    letterSpacing: 0,
    lineHeight: 1.2,
    overflowWrap: "anywhere",
  };
  const panel: CSSProperties = {
    background: t.surface,
    border: `1px solid ${t.muted}50`,
    borderRadius: t.radius,
    padding: gap,
  };
  const filled = t.buttonStyle === "solid" || t.buttonStyle === "pill";
  const primary: CSSProperties = {
    background: filled ? t.accent : "transparent",
    color: filled ? t.accentInk : signalText(t),
    borderRadius: t.buttonStyle === "pill" ? 999 : t.buttonStyle === "underline" ? 0 : t.radius,
    border: t.buttonStyle === "outline" ? `2px solid ${t.accent}` : "0 solid transparent",
    borderBottom: t.buttonStyle === "underline" ? `2px solid ${t.accent}` : undefined,
    boxShadow: "none",
    minHeight: 44,
    minWidth: 44,
  };
  const field: CSSProperties = {
    background: t.bg,
    color: t.ink,
    border: `1px solid ${t.muted}`,
    borderRadius: t.radius,
    padding: 12,
    width: "100%",
    minWidth: 0,
  };
  const records = ["Jordan Lee", "Morgan Chen", "Alex Rivera"]
    .filter((n) => n.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => (ascending ? a.localeCompare(b) : b.localeCompare(a)));
  const titles = {
    dashboard: "Overview",
    table: "Activity",
    settings: "Settings",
    "sign-in": "Welcome back",
    empty: "Your workspace",
    error: "Activity",
    loading: "Activity",
  };
  return (
    <div
      style={{
        background: t.bg,
        color: t.ink,
        fontFamily: `"${t.bodyFont}", sans-serif`,
        fontSize: 16,
      }}
    >
      <header
        style={{
          padding: gap,
          borderBottom: `1px solid ${t.muted}50`,
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
        }}
      >
        <strong style={heading}>{c.brand}</strong>
        <span style={{ color: t.muted, fontSize: 12 }}>Sample workspace</span>
      </header>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: phone || screen === "sign-in" ? "1fr" : "140px minmax(0,1fr)",
        }}
      >
        {!phone && screen !== "sign-in" && (
          <aside style={{ padding: gap, borderRight: `1px solid ${t.muted}50` }}>
            <nav aria-label="Sample navigation" className="space-y-5">
              {[
                [LayoutDashboard, "Overview"],
                [BarChart3, "Activity"],
                [Settings, "Settings"],
              ].map(([Icon, label]) => {
                const I = Icon as typeof Settings;
                return (
                  <div key={String(label)} className="flex items-center gap-2">
                    <I size={16} />
                    <span>{String(label)}</span>
                  </div>
                );
              })}
            </nav>
          </aside>
        )}
        <main style={{ padding: gap, minWidth: 0 }}>
          <h1 style={{ ...heading, fontSize: 28, marginBottom: gap }}>{titles[screen]}</h1>
          {screen === "dashboard" && (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: phone ? "1fr" : "repeat(3,minmax(0,1fr))",
                  gap,
                }}
              >
                {["Active", "Completed", "Awaiting review"].map((label, i) => (
                  <div key={label} style={panel}>
                    <p style={{ color: t.muted }}>{label}</p>
                    <p style={{ ...heading, fontSize: 32, fontVariantNumeric: "tabular-nums" }}>
                      {[24, 18, 6][i]}
                    </p>
                  </div>
                ))}
              </div>
              <section className="mt-6">
                <h2 style={heading}>This week</h2>
                <div
                  className="mt-4 flex h-32 items-end gap-3"
                  role="img"
                  aria-label="Sample weekly activity: 8, 14, 10, 18, 24"
                >
                  <>
                    {[8, 14, 10, 18, 24].map((n, i) => (
                      <div
                        key={i}
                        style={{
                          flex: 1,
                          height: `${n * 4}px`,
                          background: t.accent,
                          borderRadius: Math.min(t.radius, 4),
                        }}
                      />
                    ))}
                  </>
                </div>
                <p className="mt-2" style={{ color: t.muted }}>
                  Mon · Tue · Wed · Thu · Fri
                </p>
              </section>
              <section className="mt-6 border-t pt-4" style={{ borderColor: t.muted }}>
                <h2 style={heading}>{c.features[0]?.title || "Recent activity"}</h2>
                <p className="mt-2" style={{ color: t.muted }}>
                  {c.features[0]?.body || "24 records in this sample workspace."}
                </p>
              </section>
            </>
          )}
          {screen === "table" && (
            <>
              <label className="flex items-center gap-2">
                <Search size={18} />
                <input
                  aria-label="Search sample records"
                  placeholder="Search records"
                  style={field}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <div className="mt-4 overflow-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr>
                      <th>
                        <Button
                          variant="ghost"
                          onClick={() => setAscending((v) => !v)}
                          style={{ color: signalText(t) }}
                        >
                          Name {ascending ? "↑" : "↓"}
                        </Button>
                      </th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((n) => (
                      <tr key={n} style={{ borderTop: `1px solid ${t.muted}50` }}>
                        <td className="py-4 pr-2">{n}</td>
                        <td>Active</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!records.length && <p className="py-5">No matching records</p>}
              </div>
              <p className="mt-4" style={{ color: t.muted }}>
                {records.length} sample records
              </p>
            </>
          )}
          {screen === "settings" && (
            <SampleSettings initialName={c.brand} field={field} primary={primary} />
          )}
          {screen === "sign-in" && <SampleSignIn field={field} primary={primary} />}
          {screen === "empty" && (
            <div className="py-10 text-center">
              <Inbox className="mx-auto mb-4" size={32} />
              <h2 style={heading}>{created ? "First record created" : "No records yet"}</h2>
              <Button
                className="mt-4"
                style={primary}
                onClick={() => setCreated(true)}
                disabled={created}
              >
                Create first record
              </Button>
            </div>
          )}
          {screen === "error" && (
            <div role="status" className="py-10">
              <AlertCircle size={28} />
              <h2 className="mt-3" style={heading}>
                {retried ? "Activity restored" : "Activity could not load"}
              </h2>
              <p className="my-3">Your work is still here.</p>
              <Button style={primary} onClick={() => setRetried(true)} disabled={retried}>
                Try again
              </Button>
            </div>
          )}
          {screen === "loading" && (
            <div role="status" className="flex items-center gap-3 py-10">
              <Loader2 className="animate-spin motion-reduce:animate-none" size={24} />
              Loading activity…
            </div>
          )}
        </main>
      </div>
      {phone && screen !== "sign-in" && (
        <nav
          aria-label="Sample phone navigation"
          style={{
            background: t.surface,
            borderTop: `1px solid ${t.muted}50`,
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            padding: 12,
            color: signalText(t, t.surface),
          }}
        >
          {[
            [LayoutDashboard, "Overview"],
            [BarChart3, "Activity"],
            [Settings, "Settings"],
          ].map(([Icon, label]) => {
            const I = Icon as typeof Settings;
            return (
              <span key={String(label)} className="flex flex-col items-center gap-1 text-xs">
                <I size={20} />
                {String(label)}
              </span>
            );
          })}
        </nav>
      )}
    </div>
  );
}

type SampleFormStyles = { field: CSSProperties; primary: CSSProperties };

// Each form owns its practice feedback. Leaving a screen removes both its fields
// and its result, while changing design tokens keeps the current exercise intact.
function SampleSettings({
  initialName,
  field,
  primary,
}: SampleFormStyles & { initialName: string }) {
  const [name, setName] = useState(initialName);
  const [saved, setSaved] = useState(false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(true);
      }}
      onChange={() => setSaved(false)}
      className="space-y-4"
    >
      <label className="block">
        Workspace name
        <input style={field} value={name} required onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" defaultChecked />
        Email updates
      </label>
      <Button type="submit" style={primary}>
        Save changes
      </Button>
      {saved && (
        <p role="status" className="flex items-center gap-2">
          <Check size={18} />
          Saved in this preview
        </p>
      )}
    </form>
  );
}

function SampleSignIn({ field, primary }: SampleFormStyles) {
  const [complete, setComplete] = useState(false);
  return (
    <form
      className="mx-auto max-w-sm space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setComplete(true);
      }}
      onChange={() => setComplete(false)}
    >
      <p>Use made-up details here. This practice form does not access an account.</p>
      <label className="block">
        Email
        <input type="email" required style={field} autoComplete="off" />
      </label>
      <label className="block">
        Password
        <input type="password" required minLength={8} style={field} autoComplete="off" />
      </label>
      <Button type="submit" style={primary}>
        Sign in
        <ArrowRight size={16} />
      </Button>
      {complete && <p role="status">Sample sign-in complete; no account was accessed.</p>}
    </form>
  );
}
