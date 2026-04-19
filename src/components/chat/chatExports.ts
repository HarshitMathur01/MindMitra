/**
 * Chat → file exporters (JSON, CSV, PDF).
 * Pulled out of the orchestrator so the main file stays focused on
 * conversation flow, not download plumbing.
 */

import type { Message } from "./chatTypes";

export const getExportFileName = (extension: "pdf" | "json" | "csv"): string => {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    const stamp =
        `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
        `_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    return `mindmitra-chat-${stamp}.${extension}`;
};

const downloadBlob = (content: BlobPart, mimeType: string, fileName: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
};

export const exportChatAsJson = (
    messages: Message[],
    sessionId: string | null,
): void => {
    const exportPayload = {
        sessionId,
        exportedAt: new Date().toISOString(),
        totalMessages: messages.length,
        messages: messages.map((message) => ({
            id: message.id,
            sender: message.sender,
            timestamp: message.timestamp.toISOString(),
            content: message.content,
        })),
    };

    downloadBlob(
        JSON.stringify(exportPayload, null, 2),
        "application/json;charset=utf-8",
        getExportFileName("json"),
    );
};

export const exportChatAsCsv = (messages: Message[]): void => {
    const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const header = ["id", "sender", "timestamp", "content"];
    const rows = messages.map((m) => [
        m.id,
        m.sender,
        m.timestamp.toISOString(),
        m.content.replace(/\r?\n/g, "\\n"),
    ]);

    const csvContent = [header, ...rows]
        .map((row) => row.map((cell) => escapeCsv(String(cell))).join(","))
        .join("\n");

    downloadBlob(csvContent, "text/csv;charset=utf-8", getExportFileName("csv"));
};

export const exportChatAsPdf = async (messages: Message[]): Promise<void> => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const horizontalPadding = 40;
    const maxTextWidth = pageWidth - horizontalPadding * 2;

    let y = 48;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("MindMitra Chat Export", horizontalPadding, y);

    y += 20;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const exportedAt = new Date().toLocaleString();
    doc.text(`Exported at: ${exportedAt}`, horizontalPadding, y);

    y += 24;
    doc.setFontSize(11);

    messages.forEach((message, index) => {
        const senderLabel = message.sender === "user" ? "User" : "MindMitra";
        const timestamp = message.timestamp.toLocaleString();
        const metaLine = `[${timestamp}] ${senderLabel}`;
        const contentLines = doc.splitTextToSize(message.content || "", maxTextWidth);

        const blockHeight = 18 + contentLines.length * 14 + 10;
        if (y + blockHeight > pageHeight - 40) {
            doc.addPage();
            y = 48;
        }

        doc.setFont("helvetica", "bold");
        doc.text(metaLine, horizontalPadding, y);
        y += 16;

        doc.setFont("helvetica", "normal");
        doc.text(contentLines.length > 0 ? contentLines : [""], horizontalPadding, y);
        y += contentLines.length * 14 + 8;

        if (index < messages.length - 1) {
            doc.setDrawColor(220);
            doc.line(horizontalPadding, y, pageWidth - horizontalPadding, y);
            y += 12;
        }
    });

    doc.save(getExportFileName("pdf"));
};
