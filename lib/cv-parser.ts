/**
 * CV parsing for auto-fill (no paid APIs).
 * 
 * Supports:
 * - PDF (.pdf) via pdf-parse
 * - Word (.docx) via mammoth
 * - Plain text (.txt) direct
 * - Old Word (.doc): NOT supported (proprietary binary format requires paid libs)
 * 
 * Extracts: name, email, phone, skills, experience years.
 * This is heuristic-based — users should review auto-filled data.
 */

export interface ParsedCV {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  skills: string[];
  experienceYears: number | null;
  rawText: string;
  warnings: string[];
}

/**
 * Extract text from a CV file buffer based on extension.
 */
export async function extractTextFromCV(
  buffer: Buffer,
  filename: string,
): Promise<{ text: string; warnings: string[] }> {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const warnings: string[] = [];

  if (ext === "pdf") {
    const pdfParseModule = await import("pdf-parse");
    const pdfParse = (pdfParseModule as any).default ?? pdfParseModule;
    const data = await pdfParse(buffer);
    return { text: data.text, warnings };
  }

  if (ext === "docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    if (result.messages.length > 0) {
      warnings.push("Some DOCX content may not have been extracted cleanly.");
    }
    return { text: result.value, warnings };
  }

  if (ext === "txt") {
    return { text: buffer.toString("utf-8"), warnings };
  }

  if (ext === "doc") {
    warnings.push(
      "Old .doc format is not supported. Please convert to .docx or .pdf and re-upload."
    );
    return { text: "", warnings };
  }

  throw new Error(`Unsupported file format: .${ext}. Please upload PDF, DOCX, or TXT.`);
}

/**
 * Extract email using regex.
 */
function extractEmail(text: string): string | null {
  const match = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  return match ? match[0] : null;
}

/**
 * Extract Pakistani phone number.
 */
function extractPhone(text: string): string | null {
  // Try Pakistani formats first.
  const pkMatch = text.match(/(?:\+?92|0)?3\d{2}[\s-]?\d{7}/);
  if (pkMatch) return pkMatch[0].replace(/[\s-]/g, "");
  // Fallback: any plausible international number.
  const intlMatch = text.match(/\+?\d{10,15}/);
  return intlMatch ? intlMatch[0] : null;
}

/**
 * Extract name (heuristic: first non-empty line, or "Name:" pattern).
 */
function extractName(text: string): string | null {
  // Try "Name: XYZ" pattern.
  const namePattern = text.match(/(?:name|full name)\s*[:\-]\s*([A-Za-z\s]{2,50})/i);
  if (namePattern && namePattern[1]) {
    return namePattern[1].trim();
  }
  // Fallback: first line that looks like a name (2-4 words, no numbers).
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  for (const line of lines.slice(0, 5)) {
    if (/^[A-Za-z\s]{2,50}$/.test(line) && line.split(/\s+/).length >= 2 && line.split(/\s+/).length <= 4) {
      // Skip if it looks like a title/heading.
      if (!/^(curriculum|resume|cv|profile)/i.test(line)) {
        return line;
      }
    }
  }
  return null;
}

/**
 * Extract skills (keyword matching against common skills).
 */
function extractSkills(text: string): string[] {
  const commonSkills = [
    // Tech
    "javascript", "typescript", "python", "java", "c++", "c#", "php", "ruby", "go", "rust",
    "react", "angular", "vue", "next.js", "node.js", "express", "django", "flask", "laravel",
    "html", "css", "sass", "tailwind", "bootstrap",
    "sql", "mysql", "postgresql", "mongodb", "redis", "firebase",
    "aws", "azure", "gcp", "docker", "kubernetes", "git", "linux",
    "machine learning", "ai", "data science", "tensorflow", "pytorch",
    // Business
    "project management", "agile", "scrum", "leadership", "communication",
    "marketing", "sales", "seo", "content writing", "graphic design",
    "accounting", "finance", "excel", "powerpoint",
    // General
    "teamwork", "problem solving", "time management",
  ];

  const lowerText = text.toLowerCase();
  const found = new Set<string>();
  for (const skill of commonSkills) {
    if (lowerText.includes(skill)) {
      found.add(skill);
    }
  }
  return Array.from(found).slice(0, 20); // limit to 20
}

/**
 * Extract years of experience (heuristic).
 */
function extractExperience(text: string): number | null {
  // Patterns like "5 years experience", "3+ years", "2 years of experience".
  const patterns = [
    /(\d+)\+?\s*years?\s*(?:of\s*)?experience/i,
    /experience\s*[:\-]?\s*(\d+)\+?\s*years?/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const years = parseInt(match[1], 10);
      if (years >= 0 && years <= 50) return years;
    }
  }
  return null;
}

/**
 * Parse a CV file and extract structured data.
 */
export async function parseCV(buffer: Buffer, filename: string): Promise<ParsedCV> {
  const { text, warnings } = await extractTextFromCV(buffer, filename);

  if (!text.trim()) {
    return {
      fullName: null,
      email: null,
      phone: null,
      skills: [],
      experienceYears: null,
      rawText: "",
      warnings: [...warnings, "No text could be extracted from this file."],
    };
  }

  return {
    fullName: extractName(text),
    email: extractEmail(text),
    phone: extractPhone(text),
    skills: extractSkills(text),
    experienceYears: extractExperience(text),
    rawText: text.slice(0, 10000), // limit for storage
    warnings,
  };
}
