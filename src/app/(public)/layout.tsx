import Link from "next/link";
import { UserNav } from "@/components/user-nav";

export default function PublicLayout({
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
                  href="/browse"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Browse Petitions
                </Link>
                <Link
                  href="/results"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Results
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
      <footer className="border-t bg-gray-50 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-gray-500">
            <p>
              United Methodist Church General Conference Petition System
            </p>
            <div className="flex gap-6">
              <Link href="/browse" className="hover:text-gray-700">
                Browse Petitions
              </Link>
              <Link href="/results" className="hover:text-gray-700">
                Results
              </Link>
              <Link href="/login" className="hover:text-gray-700">
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
