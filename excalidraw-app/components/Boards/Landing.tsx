// Public landing page shown to signed-out visitors. Routes to the auth pages.
import preview from "./slate-preview.png";

const GITHUB_URL = "https://github.com/ammarbrohi/slate";

const Logo = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

const GitHubIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11 11 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.6 1.7.2 2.9.1 3.2.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z" />
  </svg>
);

const StarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9l6.9-.7L12 2z" />
  </svg>
);

const FEATURES = [
  {
    title: "Private & team spaces",
    body: "Keep personal boards private, and organize the rest into shared team spaces.",
  },
  {
    title: "Real-time collaboration",
    body: "Draw together live on an infinite canvas — see everyone's cursors and edits instantly.",
  },
  {
    title: "End-to-end encrypted",
    body: "Your scenes and images are encrypted on your device. The server only ever stores ciphertext.",
  },
  {
    title: "Share your way",
    body: "Invite teammates by email, or hand out a password-protected public link.",
  },
];

export const Landing = () => (
  <div className="landing">
    <div className="landing-glow" />

    <header className="landing-nav">
      <div className="landing-brand">
        <Logo />
        <span>Slate</span>
      </div>
      <div className="landing-nav-actions">
        <a
          className="boards-btn landing-star-btn"
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          title="Star Slate on GitHub"
        >
          <GitHubIcon />
          <StarIcon />
          Star
        </a>
        <button
          className="boards-btn boards-btn-ghost"
          onClick={() => location.assign("/sign-in")}
        >
          Log in
        </button>
        <button
          className="boards-btn boards-btn-primary"
          onClick={() => location.assign("/sign-up")}
        >
          Sign up
        </button>
      </div>
    </header>

    <main className="landing-hero">
      <span className="landing-pill">Real-time · End-to-end encrypted</span>
      <h1 className="landing-title">
        The whiteboard your
        <br />
        whole team draws on.
      </h1>
      <p className="landing-sub">
        Sketch ideas, diagram systems, and brainstorm together on an infinite
        canvas. Private boards, team spaces, and live collaboration — synced
        everywhere, instantly.
      </p>
      <div className="landing-cta">
        <button
          className="boards-btn boards-btn-primary landing-cta-primary"
          onClick={() => location.assign("/sign-up")}
        >
          Get started — it's free
        </button>
        <button
          className="boards-btn landing-cta-secondary"
          onClick={() => location.assign("/sign-in")}
        >
          Log in
        </button>
      </div>

      <div className="landing-preview">
        <img src={preview} alt="Slate boards dashboard" loading="lazy" />
      </div>

      <section className="landing-features">
        {FEATURES.map((f) => (
          <div className="landing-feature" key={f.title}>
            <h3>{f.title}</h3>
            <p>{f.body}</p>
          </div>
        ))}
      </section>
    </main>

    <footer className="landing-footer">
      <span>
        Built on the open-source{" "}
        <a href="https://github.com/excalidraw/excalidraw" target="_blank" rel="noreferrer">
          Excalidraw
        </a>{" "}
        editor. Not affiliated with the Excalidraw project.
      </span>
      <a href={GITHUB_URL} target="_blank" rel="noreferrer">
        Slate on GitHub
      </a>
    </footer>
  </div>
);

export default Landing;
