import type { Metadata } from "next";

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
    <section className="section page-top">
      <h1 className="page-title">Bantuan</h1>
      <div className="panel faq">
        {faqs.map((f) => (
          <details key={f.q}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
