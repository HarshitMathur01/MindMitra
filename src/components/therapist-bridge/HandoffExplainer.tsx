const cards = [
  {
    title: "Structured summary",
    desc: "A one-page clinician brief with assessments and quiet flags.",
  },
  {
    title: "Pattern context",
    desc: "Trends in mood, sleep, and recurring themes from your check-ins.",
  },
  {
    title: "Your own words",
    desc: "Optional excerpts you star — never raw transcripts.",
  },
];

export function HandoffExplainer() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {cards.map((c, i) => (
        <div
          key={c.title}
          className="rounded-3xl border border-[rgba(0,0,0,0.04)] bg-[#FBF6EC] p-10 shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
        >
          <p className="qc-display text-3xl text-[#7A736A]">
            {String(i + 1).padStart(2, "0")}
          </p>
          <h4 className="qc-display mt-5 text-xl text-[#2D2A24]">{c.title}</h4>
          <p className="mt-3 text-[14px] leading-[1.6] text-[#4A4640]">{c.desc}</p>
        </div>
      ))}
    </div>
  );
}
