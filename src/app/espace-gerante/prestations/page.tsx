import type { Metadata } from "next";
import { SERVICES, stylistsForService } from "@/lib/catalog";
import { formatDuration, formatFcfa } from "@/lib/time";
import { Card, Notice, PageHeader } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Prestations et tarifs" };

export default function GerantePrestationsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Espace gérante" title="Prestations et tarifs">
        Catalogue présenté aux clientes. Durées et prix de démonstration.
      </PageHeader>
      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-noir text-xs tracking-wider text-or uppercase">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Prestation
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Durée
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Prix
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-trait">
            {SERVICES.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-noir">{s.name}</p>
                  <p className="text-xs text-sourdine">{stylistsForService(s.id).map((x) => x.name).join(", ")}</p>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{formatDuration(s.durationMin)}</td>
                <td className="px-4 py-3 text-right font-medium whitespace-nowrap text-noir">{formatFcfa(s.priceFcfa)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="mt-4">
        <Notice title="Modification des tarifs">
          Dans cette démonstration, le catalogue est fixe. La modification des prestations et des prix par la gérante fait partie des évolutions à
          valider.
        </Notice>
      </div>
    </div>
  );
}
