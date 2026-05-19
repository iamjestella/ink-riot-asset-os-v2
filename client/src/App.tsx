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
          boxShadow: "0 25px 80px rgba(0,0,0,0.35)",
        }}
      >
        <h1 style={{ fontSize: "36px", marginBottom: "12px" }}>
          Ink Riot Asset OS
        </h1>

        <p style={{ fontSize: "18px", lineHeight: "1.6", color: "#cbd5e1" }}>
          The app is deployed. Next step is connecting Google login, database,
          asset scanning, and AI bundle generation.
        </p>

        <a
          href="/api/login/google"
          style={{
            display: "inline-block",
            marginTop: "28px",
            background: "#3EBDA7",
            color: "#10213D",
            padding: "14px 22px",
            borderRadius: "12px",
            fontWeight: "bold",
            textDecoration: "none",
          }}
        >
          Sign in with Google
        </a>
      </div>
    </main>
  );
}
