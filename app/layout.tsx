import type { Metadata, Viewport } from "next";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";
import { QueryProvider } from "@/components/QueryProvider";
import { ApiSuccessAlerts } from "@/components/ApiSuccessAlerts";

export const metadata: Metadata = {
  title: { default: "LEMIGAS Super Apps", template: "%s · LEMIGAS Super Apps" },
  description: "Akses semua aplikasi LEMIGAS dalam satu pintu.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7c600",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <QueryProvider>
          {children}
          <ApiSuccessAlerts />
        </QueryProvider>
      </body>
    </html>
  );
}
