import jsPDF from "jspdf";
import type { EmotionalProfile, ConsentState } from "@/lib/types/therapist-bridge";

interface SnapshotContext {
  userId: string;
  userName: string;
  dateStr: string;
  consentMask: ConsentState;
  profileData: EmotionalProfile;
}

export function exportClinicalBriefToPDF(context: SnapshotContext): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const margins = { left: 20, right: 20, top: 25, bottom: 20 };
  let cursorY = margins.top;

  const width = doc.internal.pageSize.getWidth();
  const usableWidth = width - margins.left - margins.right;

  // Add robust pagination logic
  const checkPageBreak = (spaceNeeded: number) => {
    if (cursorY + spaceNeeded > doc.internal.pageSize.getHeight() - margins.bottom) {
      doc.addPage();
      cursorY = margins.top;
    }
  };

  /**
   * Header / SOTA Guardrail Disclaimer
   */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(30, 41, 59); // Slate-800
  doc.text("Clinical Coordination Brief", margins.left, cursorY);
  
  cursorY += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // Slate-500
  const dateStr = `Generated on: ${context.dateStr} | Source: MindMitra System`;
  doc.text(dateStr, margins.left, cursorY);

  cursorY += 10;

  // The critical safety disclaimer
  doc.setFillColor(248, 250, 252); // Soft box
  doc.rect(margins.left, cursorY, usableWidth, 22, "F");
  
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const disclaimerText = doc.splitTextToSize(
    "DISCLAIMER: This is an AI-assisted coordination brief designed to summarize self-reported data and engagements within the MindMitra application. It is NOT a clinical diagnosis, nor does it replace professional medical judgment. Crisis events summarize triggers (e.g. panic) but redact raw ideation texts to protect user privacy.",
    usableWidth - 10
  );
  doc.text(disclaimerText, margins.left + 5, cursorY + 6);
  
  cursorY += 35;

  /**
   * Patient Info
   */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text("Patient Identifying Data", margins.left, cursorY);
  
  cursorY += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  
  // Consent checked info
  const nameLine = context.consentMask.shareAnonymously 
    ? "Name: (Anonymized by user request)" 
    : `Name: ${context.userName || "Unknown"}`;
  
  doc.text(nameLine, margins.left, cursorY);
  cursorY += 6;
  doc.text(`Internal ID: ${context.userId}`, margins.left, cursorY);
  
  cursorY += 15;

  /**
   * Layer A: Facts (Assessments)
   */
  if (context.consentMask.shareAssessments) {
    checkPageBreak(40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(20, 184, 166); // Teal-500 for headers
    doc.text("Layer A: Clinical Screenings (Self-Reported)", margins.left, cursorY);
    cursorY += 8;
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    
    if (context.profileData.assessments && context.profileData.assessments.length > 0) {
      context.profileData.assessments.forEach(a => {
        checkPageBreak(10);
        doc.text(`• [${new Date(a.date).toLocaleDateString()}] ${a.type}: ${a.score} - ${a.interpretation}`, margins.left + 5, cursorY);
        cursorY += 6;
      });
    } else {
      doc.setTextColor(100, 116, 139);
      doc.text("No screening instruments completed.", margins.left + 5, cursorY);
      cursorY += 6;
    }
    
    cursorY += 10;
  }

  /**
   * Layer B: Metrics & Crisis Usage
   */
  if (context.consentMask.shareFullProfile || context.consentMask.sharePatterns) {
    checkPageBreak(40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(20, 184, 166);
    doc.text("Layer B: Trajectory & Functional Metrics", margins.left, cursorY);
    cursorY += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);

    // Crisis Events (if any)
    if (context.profileData.crisisEvents && context.profileData.crisisEvents.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.text("Somatic / Acute Distress Events logged:", margins.left + 5, cursorY);
      cursorY += 6;
      doc.setFont("helvetica", "normal");

      context.profileData.crisisEvents.forEach(ce => {
        checkPageBreak(12);
        const severityStr = ce.severity >= 4 ? "(High / Panic Level)" : "(Elevated)";
        doc.text(`• ${new Date(ce.date).toLocaleDateString()}: Triggered via ${ce.trigger_source} ${severityStr}`, margins.left + 10, cursorY);
        cursorY += 5;
        doc.text(`  Action taken: ${ce.action_taken}`, margins.left + 10, cursorY);
        cursorY += 6;
      });
    }

    // App Patterns
    if (context.profileData.patterns && context.profileData.patterns.length > 0) {
      cursorY += 4;
      doc.setFont("helvetica", "bold");
      doc.text("Platform-observed Behavioral Patterns:", margins.left + 5, cursorY);
      cursorY += 6;
      doc.setFont("helvetica", "normal");
      
      context.profileData.patterns.forEach(pattern => {
        checkPageBreak(15);
        doc.setFont("helvetica", "bold");
        doc.text(`• ${pattern.title}:`, margins.left + 10, cursorY);
        
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(pattern.description, usableWidth - 20);
        doc.text(lines, margins.left + 12, cursorY + 5);
        cursorY += 6 + (lines.length * 5);
      });
    }
    
    cursorY += 10;
  }

  /**
   * Layer C: Topics / Themes
   */
  if (context.consentMask.shareFullProfile) {
    checkPageBreak(40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(20, 184, 166);
    doc.text("Layer C: Expressed Cognitive Themes", margins.left, cursorY);
    cursorY += 8;
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);

    if (context.profileData.topics && context.profileData.topics.length > 0) {
      const topicList = context.profileData.topics.map(t => `${t.topic} (${t.sentiment})`).join(", ");
      const lines = doc.splitTextToSize(`Identified vectors from session summaries: ${topicList}`, usableWidth - 10);
      doc.text(lines, margins.left + 5, cursorY);
      cursorY += (lines.length * 6) + 10;
    } else {
      doc.setTextColor(100, 116, 139);
      doc.text("Insufficient session summaries available to identify robust themes.", margins.left + 5, cursorY);
    }
  }

  // Footer 
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // Slate-400
  const pageCount = doc.internal.pages.length - 1; // jspdf pages are 1-indexed
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(`MindMitra Therapist Coordination Brief - Confidential`, margins.left, doc.internal.pageSize.getHeight() - 10);
    doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() - margins.right - 15, doc.internal.pageSize.getHeight() - 10);
  }

  doc.save(`MindMitra_Clinical_Brief_${new Date().toISOString().split("T")[0]}.pdf`);
}
