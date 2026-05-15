import { Phone, Heart, Shield, ArrowUpRight, ShieldCheck, Lock, Stethoscope } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { HELPLINES, helplineHref } from "@/lib/helplines";

const Footer = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const links = {
    platform: [
      { label: "AI Companion", path: "/chat" },
      { label: "Interactive Avatar", path: "/chat" },
      { label: "MindGym", path: "/mindgym" },
      { label: "Therapist Bridge", path: user ? "/therapist-bridge" : "/therapy" },
    ],
    company: [
      { label: "Our Mission", path: "/about" },
      { label: "Clinical Efficacy", path: "/science" },
      { label: "Safety Plan", path: "/safety-plan" },
      { label: "Contact Us", path: "/contact" },
    ],
    legal: [
      { label: "Privacy Policy", path: "/privacy" },
      { label: "Terms of Service", path: "/terms" },
      { label: "Data Protection", path: "/data-protection" },
    ],
  };

  return (
    <footer className="w-full bg-[#1F4232] border-t border-[#2e5f4a] pt-10 pb-6 text-[#C4D5CD]" style={{ fontFamily: "var(--font-sans, 'Inter', sans-serif)" }}>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        
        {/* Main Footer Grid */}
        <div className="flex flex-col lg:flex-row justify-between gap-8 lg:gap-8 mb-8">
          
          {/* Brand & Trust Column */}
          <div className="w-full lg:w-1/3">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <span className="font-light text-2xl text-white tracking-tight" style={{ fontFamily: "var(--font-serif-display, serif)" }}>
                MindMitra
              </span>
            </Link>
            <p className="text-[#A9C2B6] text-xs leading-relaxed mb-6 max-w-sm">
              The quiet companion for the loud days. Bridging the gap between struggling in silence and seeking professional help for India's youth.
            </p>
            
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-[11px] text-[#C4D5CD]">
                <ShieldCheck className="h-3.5 w-3.5 text-[#88B8A0]" />
                <span>Fully compliant with <span className="text-white font-medium">DPDP Act 2023</span></span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-[#C4D5CD]">
                <Lock className="h-3.5 w-3.5 text-[#88B8A0]" />
                <span>End-to-end <span className="text-white font-medium">256-bit encryption</span></span>
              </div>
            </div>
          </div>

          {/* Links Columns Container */}
          <div className="w-full lg:w-auto flex flex-wrap gap-8 sm:gap-16">
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#88B8A0] mb-4">Platform</h3>
              <ul className="space-y-2.5">
                {links.platform.map((l) => (
                  <li key={l.label}>
                    <button onClick={() => navigate(l.path)} className="text-[#A9C2B6] hover:text-white text-xs font-medium transition-colors">
                      {l.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#88B8A0] mb-4">Company</h3>
              <ul className="space-y-2.5">
                {links.company.map((l) => (
                  <li key={l.label}>
                    <button onClick={() => navigate(l.path)} className="text-[#A9C2B6] hover:text-white text-xs font-medium transition-colors">
                      {l.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#88B8A0] mb-4">Legal</h3>
              <ul className="space-y-2.5">
                {links.legal.map((l) => (
                  <li key={l.label}>
                    <button onClick={() => navigate(l.path)} className="text-[#A9C2B6] hover:text-white text-xs font-medium transition-colors">
                      {l.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Clinical Disclaimer Block - Industry Standard Bottom Placement */}
        <div className="py-4 border-t border-b border-[#2A5441] mb-6 flex flex-col md:flex-row items-center justify-between gap-4 bg-transparent">
          <div className="flex items-start md:items-center gap-3 w-full md:w-auto">
            <div className="p-1.5 rounded-full bg-[#E5807A]/10 mt-0.5 md:mt-0 shrink-0">
              <Stethoscope className="h-4 w-4 text-[#E5807A]" />
            </div>
            <p className="text-[#A9C2B6] text-[11px] leading-relaxed max-w-3xl">
              <strong className="text-white font-medium uppercase tracking-wide text-[9px] mr-2">Not a clinical replacement</strong>
              MindMitra is an AI-powered zeroth layer of mental healthcare. It is not a medical device, diagnostic tool, or a replacement for therapy. If you are in a severe crisis, please reach out to emergency services immediately.
            </p>
          </div>
          <div className="flex flex-wrap md:flex-nowrap gap-2 w-full md:w-auto shrink-0">
            {HELPLINES.slice(0, 2).map((h) => (
              <a
                key={h.id}
                href={helplineHref(h)}
                className="flex items-center gap-1.5 rounded-md bg-white/5 border border-white/10 px-3 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-[#E5807A]/10 hover:border-[#E5807A]/30 hover:text-[#E5807A]"
              >
                <span>{h.name}</span>
                <ArrowUpRight className="h-2.5 w-2.5" />
              </a>
            ))}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
          <p className="text-[#88B8A0]">
            © {new Date().getFullYear()} MindMitra. All rights reserved.
          </p>
          <div className="flex items-center gap-5 text-[#88B8A0]">
            <div className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer">
              <Shield className="h-3.5 w-3.5" />
              <span>Privacy First</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-[#3A755C]"></div>
            <div className="flex items-center gap-1.5">
              <Heart className="h-3.5 w-3.5 text-[#E5807A]" />
              <span>Made with care in India</span>
            </div>
          </div>
        </div>
        
      </div>
    </footer>
  );
};

export default Footer;
