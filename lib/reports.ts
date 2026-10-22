export const REPORTS_KEY = "findit-reports-v1";

export type ReportType = "lost" | "found";
export type ReportStatus = "open" | "returned";
export type Category =
  | "Electronics"
  | "ID Cards"
  | "Bags"
  | "Books"
  | "Keys"
  | "Clothing"
  | "Other";

export type Report = {
  id: string;
  type: ReportType;
  itemName: string;
  category: Category;
  description: string;
  location: string;
  contact: string;
  image?: string;
  status: ReportStatus;
  createdAt: string;
};

const categories: Category[] = [
  "Electronics",
  "ID Cards",
  "Bags",
  "Books",
  "Keys",
  "Clothing",
  "Other",
];

function isReport(value: unknown): value is Report {
  if (!value || typeof value !== "object") return false;
  const report = value as Partial<Report>;
  return (
    typeof report.id === "string" &&
    (report.type === "lost" || report.type === "found") &&
    typeof report.itemName === "string" &&
    categories.includes(report.category as Category) &&
    typeof report.description === "string" &&
    typeof report.location === "string" &&
    typeof report.contact === "string" &&
    (report.status === "open" || report.status === "returned") &&
    typeof report.createdAt === "string" &&
    Number.isFinite(Date.parse(report.createdAt))
  );
}

export function loadReports(): { reports: Report[]; issue: boolean } {
  try {
    const raw = window.localStorage.getItem(REPORTS_KEY);
    if (!raw) return { reports: [], issue: false };
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { reports: [], issue: true };
    const validReports = parsed.filter(isReport);
    let invalidImageFound = false;
    const reports = validReports.map((report) => {
      if (report.image === undefined) return report;
      if (
        typeof report.image === "string" &&
        report.image.length <= 900_000 &&
        /^data:image\/(webp|jpeg|png);base64,/.test(report.image)
      ) return report;

      invalidImageFound = true;
      const reportWithoutImage = { ...report };
      delete reportWithoutImage.image;
      return reportWithoutImage;
    });
    return { reports, issue: reports.length !== parsed.length || invalidImageFound };
  } catch {
    return { reports: [], issue: true };
  }
}

export function saveReports(reports: Report[]): boolean {
  try {
    window.localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
    return true;
  } catch {
    return false;
  }
}

export function createReportId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
