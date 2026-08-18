export const metadata = {
  title: "Privacy Policy — Ember",
};

const sectionStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const h2Style: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 20,
};

export default function PrivacyPage() {
  return (
    <main
      style={{
        maxWidth: 640,
        margin: "0 auto",
        padding: "48px 24px 96px",
        display: "flex",
        flexDirection: "column",
        gap: 28,
      }}
    >
      <header style={sectionStyle}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32 }}>
          Ember Privacy Policy
        </h1>
        <p style={{ color: "var(--text-faint)" }}>Last updated: 19 July 2026</p>
        <p style={{ color: "var(--text-dim)" }}>
          Ember is an AI cooking companion. This policy explains what data the
          app handles and why, in plain language.
        </p>
      </header>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Accounts</h2>
        <p style={{ color: "var(--text-dim)" }}>
          Ember signs you in anonymously in the background — you can use the
          whole app without creating an account. Your recipes, pantry, and
          preferences are tied to that anonymous account on your device; if
          you uninstall the app without saving it, that data is no longer
          reachable. Optionally, you can add an email address and password
          from the profile screen to keep your kitchen across devices and
          reinstalls. The email is used only for sign-in and account
          confirmation — never for marketing.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>What the app collects</h2>
        <p style={{ color: "var(--text-dim)" }}>
          To do its job, Ember processes what you give it while cooking:
        </p>
        <ul style={{ color: "var(--text-dim)", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
          <li>
            <strong>Chat messages</strong> you type or dictate to the cooking
            assistant.
          </li>
          <li>
            <strong>Photos</strong> you choose to take or upload (for example,
            of your pantry or ingredients).
          </li>
          <li>
            <strong>Voice audio</strong> when you use voice input, which is
            transcribed to text. Spoken Ember replies use an AI-generated
            voice, not a human recording.
          </li>
          <li>
            <strong>App activity</strong> such as saved recipes, pantry items,
            shopping lists, and cook-session progress.
          </li>
        </ul>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Where it goes</h2>
        <ul style={{ color: "var(--text-dim)", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
          <li>
            Chat messages, photos, voice audio, and text selected for spoken
            playback are sent to our AI provider, OpenAI, to generate
            responses, analyze images, transcribe speech, and produce Ember&apos;s
            AI-generated voice. OpenAI processes this data to provide the
            service.
          </li>
          <li>
            Your app data (recipes, pantry, chats) is stored in our database,
            hosted by Supabase, and protected so only your anonymous account
            can read it.
          </li>
          <li>All data is encrypted in transit (HTTPS).</li>
        </ul>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>What we don&apos;t do</h2>
        <ul style={{ color: "var(--text-dim)", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
          <li>No ads, and no data sold or shared for advertising.</li>
          <li>No tracking across other apps or websites.</li>
          <li>
            No personal identity required — the app works without knowing your
            name or email, and an email is stored only if you choose to save
            your account with one.
          </li>
        </ul>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Data deletion</h2>
        <p style={{ color: "var(--text-dim)" }}>
          To request deletion of the data tied to your anonymous account, email{" "}
          <a href="mailto:philipkantewa@gmail.com" style={{ color: "var(--accent)" }}>
            philipkantewa@gmail.com
          </a>{" "}
          — from your account email if you saved one (so we can find your
          data), or describe roughly when you used the app if you stayed
          anonymous. We&apos;ll delete the matching account data. Uninstalling
          without a saved email also permanently orphans the account — nothing
          in it can be linked back to you.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Changes</h2>
        <p style={{ color: "var(--text-dim)" }}>
          If this policy changes, the new version will be posted at this
          address with an updated date.
        </p>
      </section>
    </main>
  );
}
