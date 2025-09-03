import * as React from "react";

type Props = {
  ok: boolean;
  title: string;
  kpi?: string | number;
  message: string;
  children?: React.ReactNode;
};

export default function ComplianceCard({ ok, title, kpi, message, children }: Props) {
  return (
    <div
      className={`rounded-2xl p-4 shadow-sm border ${
        ok ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-white text-sm ${
            ok ? "bg-green-600" : "bg-amber-600"
          }`}
        >
          {ok ? "✓" : "!"}
        </span>
        <h3 className="font-semibold text-sm">{title}</h3>
        {kpi !== undefined && (
          <span className="ml-auto text-xs px-2 py-1 rounded-full bg-white/70 border">
            {kpi}
          </span>
        )}
      </div>
      <p className="mt-2 text-sm">{message}</p>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
