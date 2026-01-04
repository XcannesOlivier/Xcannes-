export default function SearchAndAddBar({
  searchTerm,
  onSearchChange,
  showAddPair,
  onToggleAddPair,
  addLabel,
  searchPlaceholder,
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-4">
      <div className="flex-1">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-xcannes-green transition-colors"
        />
      </div>
      <button
        onClick={onToggleAddPair}
        className="px-4 py-2 bg-[#0f7fe1]/20 hover:bg-[#0f7fe1]/30 text-[#0f7fe1] border border-[#0f7fe1]/40 font-medium rounded-lg transition-all duration-200 text-sm flex items-center justify-center hover:scale-105"
      >
        {showAddPair ? addLabel.close : addLabel.open}
      </button>
    </div>
  );
}
