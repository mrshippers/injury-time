"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="pressable print:hidden h-10 rounded-[2px] border border-line-strong bg-pitch px-3 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink hover:bg-panel-2"
    >
      print for the committee
    </button>
  );
}
