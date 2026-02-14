import Link from "next/link";
import { UserNav } from "@/components/user-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <nav className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-8">
              <Link href="/" className="text-xl font-bold">
                GC Petitions
              </Link>
              <div className="hidden md:flex gap-6">
                <Link
                  href="/dashboard"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Dashboard
                </Link>
                <Link
                  href="/petitions"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Petitions
                </Link>
                <Link
                  href="/committees"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Committees
                </Link>
                <Link
                  href="/calendar"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Calendar
                </Link>
                <Link
                  href="/admin"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Admin
                </Link>
              </div>
            </div>
            <UserNav />
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
