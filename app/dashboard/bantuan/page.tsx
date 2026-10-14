import type { Metadata } from "next";
import { PageHeader } from "@/components/common/PageHeader";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Bantuan" };

const faqs = [
  {
    q: "Bagaimana cara membuka aplikasi?",
    a: "Buka halaman Beranda, lalu pilih Open app pada kartu aplikasi yang Anda butuhkan.",
  },
  {
    q: "Saya lupa kata sandi. Apa yang harus dilakukan?",
    a: "Hubungi administrator sistem LEMIGAS untuk mengatur ulang kata sandi Anda.",
  },
  {
    q: "Aplikasi yang saya butuhkan tidak muncul.",
    a: "Akses aplikasi diberikan sesuai peran. Ajukan permintaan akses ke administrator.",
  },
];

export default function BantuanPage() {
  return (
    <section className="space-y-5 py-1">
      <PageHeader title="Bantuan" />
      <Card>
        <CardContent className="py-2">
          <Accordion>
            <>
              {faqs.map((f) => (
                <AccordionItem key={f.q} value={f.q}>
                  <AccordionTrigger className="py-4">{f.q}</AccordionTrigger>
                  <AccordionContent className="pb-4 text-muted-foreground">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </>
          </Accordion>
        </CardContent>
      </Card>
    </section>
  );
}
