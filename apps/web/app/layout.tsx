import type { Metadata } from "next";
import { Barlow_Condensed, Nunito, Vollkorn } from "next/font/google";
import "./globals.css";

const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin", "vietnamese"] });
const vollkorn = Vollkorn({ variable: "--font-vollkorn", subsets: ["latin", "vietnamese"] });
const barlow = Barlow_Condensed({
  variable: "--font-barlow",
  subsets: ["latin", "vietnamese"],
  weight: "500",
});

export const metadata: Metadata = {
  title: { default: "Cocoon CRM", template: "%s · Cocoon CRM" },
  description: "Hệ thống quản lý quan hệ khách hàng của Cocoon",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${nunito.variable} ${vollkorn.variable} ${barlow.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
