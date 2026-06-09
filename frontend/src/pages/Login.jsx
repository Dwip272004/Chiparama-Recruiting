import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useAuth } from "../contexts/AuthContext";
import { Briefcase, Eye, EyeOff, Loader } from "lucide-react";

export default function Login() {
  const { signIn, profile, isAdmin, isVendor } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [showPw, setShowPw]   = useState(false);
  const [authError, setAuthError] = useState("");

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();

  async function onSubmit({ email, password }) {
    setAuthError("");
    try {
      await signIn(email, password);
      // Redirect to where they came from, or role-based default
      const from = location.state?.from?.pathname;
      if (from && from !== "/login") { navigate(from, { replace: true }); return; }
      // Default redirect based on role — profile may not be loaded yet;
      // RequireAuth will handle the final redirect via role check
      navigate("/admin", { replace: true });
    } catch (err) {
      setAuthError(err.message ?? "Invalid email or password.");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-indigo-900 to-indigo-800
                    flex items-center justify-center p-4">
      {/* Decorative blobs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md">

        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white/15
                          rounded-2xl mb-4 ring-1 ring-white/20">
            <Briefcase className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">TalentBoard</h1>
          <p className="text-indigo-300 text-sm mt-1">Recruitment Operating System</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Sign in</h2>
          <p className="text-sm text-gray-400 mb-6">Enter your credentials to continue</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Email
              </label>
              <input
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                {...register("email", { required: "Email is required" })}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm
                           focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
              />
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  {...register("password", { required: "Password is required" })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-11 text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            {/* Auth error */}
            {authError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                {authError}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white
                         font-semibold py-3 rounded-xl hover:bg-indigo-700 transition-colors
                         disabled:opacity-60 disabled:cursor-not-allowed shadow-sm mt-2"
            >
              {isSubmitting
                ? <><Loader className="w-4 h-4 animate-spin" /> Signing in…</>
                : "Sign In"
              }
            </button>
          </form>
        </div>

        <p className="text-center text-indigo-400 text-xs mt-6">
          Contact your administrator if you need access.
        </p>
      </div>
    </div>
  );
}
