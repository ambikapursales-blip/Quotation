"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SecretLoginPage() {
  const router = useRouter();
  const [secretKey, setSecretKey] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [disabled, setDisabled] = useState(true);

  // Check if feature is enabled on mount
  const [featureEnabled, setFeatureEnabled] = useState(false);

  // We'll check if the feature is enabled by trying to access the API
  // If it returns 404, the feature is disabled
  const checkFeature = async () => {
    try {
      const res = await fetch("/api/secret-login/check");
      if (res.ok) {
        const data = await res.json();
        setFeatureEnabled(data.enabled === true);
      } else {
        setFeatureEnabled(false);
      }
    } catch {
      setFeatureEnabled(false);
    }
  };

  // Run check on mount
  if (typeof window !== "undefined") {
    checkFeature();
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/secret-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secretKey, userId: userId || undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Secret login failed");
        setLoading(false);
        return;
      }

      // Success - redirect to dashboard
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  };

  // If feature is disabled, show 404-like page
  if (!featureEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-4xl font-medium text-gray-900">404</h1>
          <p className="mt-2 text-lg text-gray-600">Page not found</p>
          <Link href="/" className="mt-4 inline-block text-indigo-600 hover:text-indigo-500">
            Go to home page
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white shadow rounded-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Internal Access</h1>
            <p className="mt-2 text-sm text-gray-600">
              Enter the secret key to create an authenticated session
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="secretKey" className="block text-sm font-medium text-gray-700 mb-1">
                Secret Key
              </label>
              <input
                id="secretKey"
                type="password"
                autoComplete="off"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter secret key"
              />
            </div>

            <div>
              <label htmlFor="userId" className="block text-sm font-medium text-gray-700 mb-1">
                User ID (optional)
              </label>
              <input
                id="userId"
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="MongoDB _id of user (leave empty for first active user)"
              />
              <p className="mt-1 text-xs text-gray-500">
                If not provided, the first active user will be used.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !secretKey.trim()}
              className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating session..." : "Create Session"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/login" className="text-sm text-indigo-600 hover:text-indigo-500">
              Back to normal login
            </Link>
          </div>
        </div>

        <div className="mt-4 text-center text-xs text-gray-500">
          <p>This route is only accessible when explicitly enabled via environment variables.</p>
          <p>ENABLE_SECRET_LOGIN=true and SECRET_LOGIN_KEY must be configured.</p>
        </div>
      </div>
    </div>
  );
}