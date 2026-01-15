"use client";

// Sparkline minimaliste réutilisable pour les mini courbes de prix.
// Accepte un tableau de valeurs numériques (non normalisées) et
// normalise automatiquement pour le tracé.
export default function SparklineMini({
  values,
  width = 80,
  height = 24,
  padding = 2,
  strokeColor = "#4ade80",
  areaColor = "rgba(34,197,94,0.35)",
  showArea = false,
  className = "",
}) {
  if (!Array.isArray(values) || values.length < 2) return null;

  const finiteValues = values
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v));

  if (finiteValues.length < 2) return null;

  const min = Math.min(...finiteValues);
  const max = Math.max(...finiteValues);
  const range = max - min || 1;

  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  const points = finiteValues.map((value, index) => {
    const ratio = (value - min) / range;
    const x =
      (index / (finiteValues.length - 1 || 1)) * innerWidth + padding;
    const y = height - padding - ratio * innerHeight;
    return { x, y };
  });

  const pathD = points
    .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  const areaD = showArea
    ? `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${
        points[0].x
      } ${height - padding} Z`
    : null;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      preserveAspectRatio="none"
    >
      {showArea && areaD && (
        <path d={areaD} fill={areaColor} stroke="none" />
      )}
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
