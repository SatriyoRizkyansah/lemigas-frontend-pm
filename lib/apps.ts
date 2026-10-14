// Daftar aplikasi pada portal. Tambahkan entri baru di sini, kartu akan muncul otomatis.
export type AppItem = {
  id: string;
  name: string;
  description: string;
  href: string;
  status: "active" | "maintenance";
};

export const apps: AppItem[] = [
  {
    id: "project-m",
    name: "PROJECT - M",
    description: "Lemigas Project Management",
    href: "https://example.com/project-m",
    status: "active",
  },
];
