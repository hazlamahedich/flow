import { Topbar } from "@/components/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { invoices, clients } from "@/lib/mock-data";
import { formatCurrency } from "@/lib/utils";
import { Receipt, Plus, AlertCircle } from "lucide-react";

const statusTone = {
  paid: "success",
  sent: "flow",
  draft: "neutral",
  overdue: "danger",
  partial: "warn",
} as const;

export default function InvoicesPage() {
  const totalPaid = invoices.filter(i => i.status === "paid").reduce((a, i) => a + i.amount, 0);
  const totalOutstanding = invoices.filter(i => i.status === "sent").reduce((a, i) => a + i.amount, 0);
  const totalOverdue = invoices.filter(i => i.status === "overdue").reduce((a, i) => a + i.amount, 0);

  return (
    <>
      <Topbar
        title="Invoices"
        subtitle="AR Collection agent is chasing 3 overdue invoices · expected payment $1,450 within 7 days"
      />
      <div className="p-6 max-w-[1200px] space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard label="Paid (this month)" amount={totalPaid} tone="success" />
          <SummaryCard label="Outstanding" amount={totalOutstanding} tone="flow" />
          <SummaryCard label="Overdue" amount={totalOverdue} tone="danger" />
        </div>

        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Receipt size={14} className="text-ink-500" />
                <h3 className="text-sm font-semibold text-ink-900">All invoices</h3>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">From time entries</Button>
                <Button variant="primary" size="sm">
                  <Plus size={14} /> New invoice
                </Button>
              </div>
            </div>

            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-ink-500">
                <tr className="text-left">
                  <th className="font-medium py-2">Number</th>
                  <th className="font-medium">Client</th>
                  <th className="font-medium">Amount</th>
                  <th className="font-medium">Status</th>
                  <th className="font-medium">Issued</th>
                  <th className="font-medium">Due</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => {
                  const c = clients.find((x) => x.id === i.clientId)!;
                  return (
                    <tr key={i.id} className="border-t border-ink-100 hover:bg-ink-50/40">
                      <td className="py-3 font-medium text-ink-900">{i.number}</td>
                      <td>{c.name}</td>
                      <td className="font-medium">{formatCurrency(i.amount)}</td>
                      <td>
                        <Badge tone={statusTone[i.status]}>
                          {i.status === "overdue" && <AlertCircle size={10} />}
                          {i.status}{i.daysOverdue ? ` ${i.daysOverdue}d` : ""}
                        </Badge>
                      </td>
                      <td className="text-ink-600">{i.issued ?? "—"}</td>
                      <td className="text-ink-600">{i.due ?? "—"}</td>
                      <td className="text-right">
                        <Button variant="ghost" size="sm">View</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function SummaryCard({ label, amount, tone }: { label: string; amount: number; tone: "success" | "flow" | "danger" }) {
  const cls = {
    success: "bg-emerald-50 text-emerald-700",
    flow: "bg-flow-50 text-flow-700",
    danger: "bg-red-50 text-red-700",
  }[tone];
  return (
    <Card>
      <CardContent className="p-5">
        <div className={`inline-flex h-7 px-2 items-center rounded-md text-[11px] font-medium ${cls}`}>{label}</div>
        <div className="mt-3 text-2xl font-semibold text-ink-900">{formatCurrency(amount)}</div>
      </CardContent>
    </Card>
  );
}
