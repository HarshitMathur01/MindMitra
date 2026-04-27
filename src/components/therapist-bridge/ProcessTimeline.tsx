const steps = [
  { title: "Intake", desc: "Tell us what you need." },
  { title: "Match", desc: "We surface the people who fit." },
  { title: "Consent", desc: "Choose exactly what to share." },
  { title: "Book", desc: "Confirm your first session." },
];

export function ProcessTimeline() {
  return (
    <div className="rounded-3xl border border-[rgba(0,0,0,0.04)] bg-[#FBF6EC] p-12 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      <ol className="relative grid gap-10 sm:grid-cols-4 sm:gap-6">
        <span
          aria-hidden
          className="pointer-events-none absolute left-0 right-0 top-[1.4rem] hidden h-px bg-[#A8BC9A] opacity-40 sm:block"
        />
        {steps.map((s, i) => (
          <li key={s.title} className="relative">
            <span
              aria-hidden
              className="absolute left-0 top-0 hidden h-2.5 w-2.5 -translate-y-[3px] rounded-full bg-[#FBF6EC] ring-1 ring-[#A8BC9A] sm:block"
              style={{ left: "0" }}
            />
            <span className="qc-display block text-3xl text-[#7A736A]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <p className="qc-display mt-3 text-xl text-[#2D2A24]">{s.title}</p>
            <p className="mt-2 text-[14px] leading-[1.6] text-[#4A4640]">{s.desc}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
