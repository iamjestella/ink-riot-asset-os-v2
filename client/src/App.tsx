export default function App() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f172a",
        color: "white",
        fontFamily: "Arial, sans-serif",
        padding: "40px",
      }}
    >
      <div
        style={{
          maxWidth: "720px",
          width: "100%",
          background: "#111827",
          border: "1px solid #334155",
          borderRadius: "24px",
          padding: "40px",
        }}
      >
        <h1>Ink Riot Asset OS</h1>

        <p>
          If you reached this page after Google login, the app is deployed and
          the OAuth redirect is working.
        </p>

        <a href="/api/login/google">
          Sign in / reconnect Google
        </a>
      </div>
    </main>
  );
}
