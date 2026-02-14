import Link from "next/link";
import { UserNav } from "@/components/user-nav";
import { MobileNav } from "@/components/mobile-nav";

const DASHBOARD_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/documents", label: "Documents" },
  { href: "/petitions", label: "Petitions" },
  { href: "/committees", label: "Committees" },
  { href: "/calendar", label: "Calendar" },
  { href: "/admin", label: "Admin" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <nav className="border-b bg-white relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-8">
              <Link href="/" className="text-xl font-bold">
                GC Petitions
              </Link>
              <div className="hidden md:flex gap-6">
                {DASHBOARD_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <UserNav />
              <MobileNav links={DASHBOARD_LINKS} />
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
