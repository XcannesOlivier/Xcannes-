"use client";

import React from "react";

export default class ClientErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    try {
      // eslint-disable-next-line no-console
      console.error("[ClientErrorBoundary]", this.props?.name || "", error, info);
    } catch {
      // ignore
    }
  }

  componentDidUpdate(prevProps) {
    if (!this.state.error) return;
    if (this.props.resetKey === prevProps.resetKey) return;
    // eslint-disable-next-line react/no-did-update-set-state
    this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const title = this.props?.title || "Application error";
    const message = String(error?.message || error || "");
    const stack = String(error?.stack || "");

    const handleCopy = async () => {
      const payload = [title, message, stack].filter(Boolean).join("\n\n");
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(payload);
          return;
        }
      } catch {
        // ignore
      }
      try {
        const el = document.createElement("textarea");
        el.value = payload;
        el.setAttribute("readonly", "");
        el.style.position = "absolute";
        el.style.left = "-9999px";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      } catch {
        // ignore
      }
    };

    return (
      <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/80 md:backdrop-blur-sm px-4">
        <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-elevated shadow-[0_28px_90px_rgba(0,0,0,0.6)] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
            <div className="text-sm font-semibold text-white/90">{title}</div>
            <div className="flex-1" />
            {typeof this.props.onClose === "function" ? (
              <button
                type="button"
                onClick={this.props.onClose}
                className="px-3 py-1.5 rounded-lg bg-white/10 text-white/80 hover:bg-white/15 transition-colors text-xs font-semibold"
              >
                Fermer
              </button>
            ) : null}
          </div>
          <div className="p-4 space-y-3">
            <div className="text-xs text-white/70 break-words">{message}</div>
            {stack ? (
              <pre className="max-h-[50vh] overflow-auto rounded-xl bg-black/40 border border-white/10 p-3 text-[11px] leading-snug text-white/60 whitespace-pre-wrap break-words">
                {stack}
              </pre>
            ) : null}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="px-3 py-2 rounded-lg bg-white/10 text-white/80 hover:bg-white/15 transition-colors text-xs font-semibold"
              >
                Copier l’erreur
              </button>
              <div className="text-[11px] text-white/45">
                Collez ici le message copié pour que je corrige.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

