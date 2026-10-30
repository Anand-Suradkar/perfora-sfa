export default function SeedPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md rounded-2xl bg-white p-6 text-center shadow">
        <h1 className="text-xl font-bold text-gray-900">Seeding Disabled</h1>
        <p className="mt-3 text-sm text-gray-600">
          Database seeding is disabled in the application. Use a local Firebase Emulator or a dedicated disposable test project for seed data.
        </p>
      </div>
    </main>
  );
}
