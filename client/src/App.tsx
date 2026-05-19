export default function App() {
  const comingSoon = (feature: string) => {
    alert(`${feature} is connected to the dashboard, but the backend action still needs to be wired.`);
  };

  return (
    <main style={{ minHeight: "100vh", background: "#0f172a", color: "white", fontFamily: "Arial, sans-serif" }}>
      <header style={{ padding: "24px 40px", borderBottom: "1px solid #334155" }}>
        <h1 style={{ margin: 0 }}>Ink Riot Asset OS</h1>
        <p style={{ color: "#94a3b8" }}>Asset dashboard</p>
      </header>

      <section style={{ padding: "40px", display: "grid", gap: "24px", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        <div style={card}>
          <h2>Scan Google Drive</h2>
          <p>Connect and scan artwork folders.</p>
          <button style={button} onClick={() => comingSoon("Google Drive scanning")}>Start Scan</button>
        </div>

        <div style={card}>
          <h2>Asset Library</h2>
          <p>View imported artwork and mockups.</p>
          <button style={button} onClick={() => comingSoon("Asset Library")}>View Assets</button>
        </div>

        <div style={card}>
          <h2>Create Bundles</h2>
          <p>Generate themed art/product bundles.</p>
          <button style={button} onClick={() => comingSoon("Bundle generation")}>Generate Bundle</button>
        </div>

        <div style={card}>
          <h2>AI Content</h2>
          <p>Create tags, titles, prompts, and listing copy.</p>
          <button style={button} onClick={() => comingSoon("AI content generation")}>Generate Copy</button>
        </div>
      </section>
    </main>
  );
}

const card = {
  background: "#111827",
  border: "1px solid #334155",
  borderRadius: "20px",
  padding: "28px",
} as const;

const button = {
  marginTop: "16px",
  background: "#3EBDA7",
  color: "#10213D",
  border: "none",
  borderRadius: "12px",
  padding: "12px 18px",
  fontWeight: "bold",
  cursor: "pointer",
} as const;
