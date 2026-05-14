const MARKETING_URL = "https://meta-leads-qualifier-mu.vercel.app";

export default function Marketing() {
  return (
    <div style={{ background: "#080B14" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          padding: "6px 16px",
          background: "#111a2e",
          borderBottom: "1px solid #1c2d42",
        }}
      >
        <a
          href={MARKETING_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 11, color: "#7a90aa", textDecoration: "none" }}
        >
          abrir em nova aba ↗
        </a>
      </div>
      <iframe
        src={MARKETING_URL}
        title="Marketing — Meta Lead Qualifier"
        style={{
          display: "block",
          width: "100%",
          height: "calc(100vh - 50px - 33px)",
          border: 0,
        }}
      />
    </div>
  );
}
