import React from "react";
import { headers } from "next/headers";

type Report = {
  id: string;
  org_id: string;
  mission_id: string | null;
  type: string | null;
  status: "Generating" | "Ready" | "Failed" | string;
  generated_at: string | null;
  title: string | null;
  pdf_url: string | null;
  kpis: Record<string, number> | null;
  meta: Record<string, any> | null;
};

type ReportsResponse =
  | { ok: true; reports: Report[] }
  | { ok: false; error: string };

const STATUS_BADGES: Record<string, string> = {
  Ready: "bg-green-100 text-green-700",
  Failed: "bg-red-100 text-red-700",
  default: "bg-yellow-100 text-yellow-800",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleString();
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { orgId?: string };
}) {
  const orgId = searchParams?.orgId?.trim();

  if (!orgId) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-2">Reports</h1>
        <p className="text-slate-600">
          Add <code>?orgId=&lt;uuid&gt;</code> to the URL to view reports.
        </p>
      </div>
    );
  }

  const h = headers();
  const host =
    h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.includes("localhost") ? "http" : "https");
  const baseUrl = `${proto}://${host}`;
  const endpoint = `${baseUrl}/api/reports?orgId=${encodeURIComponent(
    orgId
  )}&limit=50`;

  let reports: Report[] = [];
  let errorMessage: string | null = null;

  try {
    const res = await fetch(endpoint, { cache: "no-store" });
    const body = (await res.json()) as ReportsResponse;
    if (!res.ok) {
      const err =
        (!body.ok && "error" in body ? body.error : undefined) ??
        `HTTP ${res.status}`;
      throw new Error(err);
    }
    if (!body.ok) {
      const { error } = body as Extract<ReportsResponse, { ok: false }>;
      throw new Error(error);
    }
    reports = Array.isArray(body.reports) ? body.reports : [];
  } catch (err: any) {
    errorMessage = String(err?.message || err);
  }

  const sortedReports = reports
    .slice()
    .sort((a, b) => {
      const aTime = a.generated_at ? Date.parse(a.generated_at) : 0;
      const bTime = b.generated_at ? Date.parse(b.generated_at) : 0;
      if (bTime !== aTime) return bTime - aTime;
      return a.id.localeCompare(b.id);
    });

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Reports</h1>

      {errorMessage ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-red-800">
          <div className="font-medium mb-1">Failed to load reports</div>
          <div>{errorMessage}</div>
          <div className="text-xs mt-2 break-all">
            Attempted endpoint: {endpoint}
          </div>
        </div>
      ) : sortedReports.length === 0 ? (
        <div className="rounded-md border border-slate-200 bg-white p-4 text-slate-600">
          No reports yet for this org.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {sortedReports.map((report) => {
            const statusClass =
              STATUS_BADGES[report.status] ?? STATUS_BADGES.default;
            const isMission = Boolean(report.mission_id);
            const store = report.meta?.store;
            const address = report.meta?.address;

            return (
              <div
                key={report.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1 min-w-0">
                    {report.pdf_url ? (
                      <a
                        href={report.pdf_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-lg font-semibold text-slate-900 hover:underline truncate"
                        title={report.pdf_url}
                      >
                        {report.title || "Untitled report"}
                      </a>
                    ) : (
                      <div className="text-lg font-semibold text-slate-900 truncate">
                        {report.title || "Untitled report"}
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-2 text-sm">
                      {report.pdf_url ? (
                        <a
                          href={report.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-primary"
                        >
                          Open PDF
                        </a>
                      ) : (
                        <a
                          href={`/api/reports/open?id=${report.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn"
                        >
                          Open PDF
                        </a>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      Generated: {formatDate(report.generated_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${statusClass}`}
                    >
                      {report.status}
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                      {isMission ? "Mission" : "Demo"}
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                      {report.type || "unknown"}
                    </span>
                  </div>
                </div>
                {(store || address) && (
                  <div className="mt-2 text-sm text-slate-700 space-y-1">
                    {store && (
                      <div>
                        <span className="font-medium">Store:</span> {store}
                      </div>
                    )}
                    {address && (
                      <div>
                        <span className="font-medium">Address:</span>{" "}
                        {address}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 text-xs text-gray-500 break-all">
        orgId: {orgId} • endpoint: {endpoint} • count: {sortedReports.length}
      </div>
    </div>
  );
}
