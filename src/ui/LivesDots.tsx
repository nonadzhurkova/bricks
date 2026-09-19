export default function LivesDots({ lives, total }: { lives: number; total: number }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: i < lives ? "#22d3ee" : "rgba(255,255,255,0.15)",
            boxShadow: i < lives ? "0 0 6px #22d3ee" : "none",
          }}
        />
      ))}
    </div>
  );
}
