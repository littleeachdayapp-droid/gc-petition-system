import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* Nav */}
      <nav className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <span className="text-xl font-bold">GC Petitions</span>
            <div className="flex items-center gap-4">
              <Link
                href="/browse"
                className="text-gray-600 hover:text-gray-900 text-sm"
              >
                Browse Petitions
              </Link>
              <Link
                href="/results"
                className="text-gray-600 hover:text-gray-900 text-sm"
              >
                Results
              </Link>
              <Link
                href="/login"
                className="text-sm border border-gray-300 rounded-lg px-4 py-2 hover:bg-gray-50"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-4xl mx-auto text-center px-4 pt-20 pb-16">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900">
            General Conference
            <br />
            <span className="text-blue-600">Petition System</span>
          </h1>
          <p className="mt-6 text-lg text-gray-600 max-w-2xl mx-auto">
            Track, search, and follow United Methodist Church legislative
            petitions through every stage — from submission through committee
            review to plenary voting.
          </p>
          <div className="flex gap-4 justify-center mt-8">
            <Link
              href="/browse"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Browse Petitions
            </Link>
            <Link
              href="/results"
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              View Results
            </Link>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-12">
          How Petitions Move Through General Conference
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {[
            {
              step: "1",
              title: "Submission",
              desc: "Delegates submit petitions proposing changes to the Book of Discipline or Book of Resolutions.",
            },
            {
              step: "2",
              title: "Committee Review",
              desc: "Legislative committees review, amend, and vote on assigned petitions.",
            },
            {
              step: "3",
              title: "Plenary Calendar",
              desc: "Committee-approved petitions are placed on the plenary calendar for full-body debate.",
            },
            {
              step: "4",
              title: "Final Vote",
              desc: "The General Conference votes to adopt or defeat each petition.",
            },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold text-lg flex items-center justify-center mx-auto mb-3">
                {item.step}
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">
                {item.title}
              </h3>
              <p className="text-sm text-gray-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="bg-gray-50 border-t">
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <h2 className="text-xl font-bold mb-2">
            Are you a UMC member?
          </h2>
          <p className="text-gray-600 mb-6">
            Any United Methodist can submit a petition. Sign in to get started,
            or create an account to participate.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/login"
              className="px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Register
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
