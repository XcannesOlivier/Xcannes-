export default function ExchangeHeader({ title, subtitle }) {
  return (
    <div className="mb-6 pt-2 bg-base border border-subtle rounded-xl px-4 py-4 md:px-6 md:py-5">
      <h1 className="text-2xl md:text-3xl font-orbitron font-bold text-white mb-2">
        {title}
      </h1>
      <p className="text-white/60 text-sm mb-0">{subtitle}</p>
    </div>
  );
}
