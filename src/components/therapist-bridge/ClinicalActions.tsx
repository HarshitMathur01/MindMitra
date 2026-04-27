import { toast } from "sonner";

export function ClinicalActions({ onPreview }: { onPreview: () => void }) {
  const linkClass =
    "text-[13.5px] text-[#4A4640] underline decoration-[rgba(0,0,0,0.15)] decoration-1 underline-offset-[6px] transition-colors hover:text-[#3F6B47] hover:decoration-[#3F6B47]";

  return (
    <div className="flex flex-wrap items-center justify-between gap-6 rounded-3xl border border-[rgba(0,0,0,0.04)] bg-[#FBF6EC] p-8 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      <div className="min-w-0">
        <p className="qc-display text-xl text-[#2D2A24]">Clinical sync &amp; export</p>
        <p className="mt-2 max-w-[60ch] text-[14px] leading-[1.6] text-[#7A736A]">
          Pull wearable signals or export a one-page clinician summary.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
        <button
          type="button"
          className={linkClass}
          onClick={() => toast.success("Wearable connected", { description: "Mock sync complete." })}
        >
          Sync device
        </button>
        <button
          type="button"
          className={linkClass}
          onClick={() => toast("PDF export queued", { description: "Demo only — no file generated." })}
        >
          Export PDF
        </button>
        <button
          type="button"
          onClick={onPreview}
          className="inline-flex items-center justify-center rounded-full bg-[#3F6B47] px-6 py-2.5 text-[13.5px] font-medium text-[#F5EDE0] transition-[transform,filter] duration-200 ease-out hover:-translate-y-px hover:brightness-[0.92] motion-reduce:hover:transform-none motion-reduce:transition-none"
        >
          Preview what therapist sees
        </button>
      </div>
    </div>
  );
}
