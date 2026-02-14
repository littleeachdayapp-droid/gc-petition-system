import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link
          href="/petitions"
          className="p-6 border rounded-lg hover:shadow-md transition-shadow"
        >
          <h2 className="text-xl font-semibold mb-2">Petitions</h2>
          <p className="text-gray-600">
            Submit and track legislative petitions.
          </p>
        </Link>
        <Link
          href="/committees"
          className="p-6 border rounded-lg hover:shadow-md transition-shadow"
        >
          <h2 className="text-xl font-semibold mb-2">Committees</h2>
          <p className="text-gray-600">
            View committee assignments and actions.
          </p>
        </Link>
        <Link
          href="/calendar"
          className="p-6 border rounded-lg hover:shadow-md transition-shadow"
        >
          <h2 className="text-xl font-semibold mb-2">Plenary Calendar</h2>
          <p className="text-gray-600">
            Track plenary session schedules and votes.
          </p>
        </Link>
        <Link
          href="/admin"
          className="p-6 border rounded-lg hover:shadow-md transition-shadow"
        >
          <h2 className="text-xl font-semibold mb-2">Admin</h2>
          <p className="text-gray-600">
            Manage the petition pipeline and system settings.
          </p>
        </Link>
      </div>
    </div>
  );
}
