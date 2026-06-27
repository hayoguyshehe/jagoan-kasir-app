"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { getContrastColor } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const brandName = process.env.NEXT_PUBLIC_BRAND_NAME || "Jagoan Kasir";

  const bgImage = process.env.NEXT_PUBLIC_LOGIN_BG_IMAGE || "https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?q=80&w=2038&auto=format&fit=crop";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data, error: authError } = await insforge.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;
      if (!data || !data.user) throw new Error("User not found");

      // Ensure the user has the correct role (Admin or Owner)
      const { data: userData, error: userError } = await insforge
        .from("users")
        .select("role")
        .eq("id", data.user.id)
        .single();

      if (userError) throw userError;

      if (userData.role !== "ADMIN" && userData.role !== "OWNER") {
        await insforge.auth.signOut();
        throw new Error("You do not have permission to access the dashboard.");
      }

      // Success
      // The session is set automatically by @insforge/sdk
      // However, for Next.js App Router middleware to see it, we need to set the cookie.
      // @ts-ignore
      document.cookie = `insforge-auth-token=${data.session?.access_token}; path=/; max-age=${60 * 60 * 24 * 7}; secure; samesite=strict`;

      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An error occurred during login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex w-full max-w-[1200px] h-[800px] max-h-[90vh] bg-white rounded-[2.5rem] shadow-2xl overflow-hidden relative">
      {/* LEFT COLUMN: Login Form */}
      <div className="w-full lg:w-1/2 p-8 sm:p-12 md:p-16 flex flex-col justify-center items-center lg:items-start h-full overflow-y-auto">
        <div className="w-full max-w-sm mx-auto flex flex-col items-center">
          <div className="mb-10 text-center">
            <h2 className="text-xl font-bold mb-6" style={{ color: process.env.NEXT_PUBLIC_PRIMARY_COLOR }}>
              {brandName}
            </h2>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 leading-tight">
              Manage your<br />business
            </h1>
          </div>

          <form onSubmit={handleLogin} className="w-full space-y-5">
            {error && (
              <div className="bg-red-50 text-red-500 p-4 rounded-2xl text-sm font-medium text-center">
                {error}
              </div>
            )}
            
            <div className="space-y-1">
              <Input 
                id="email" 
                type="email" 
                placeholder="Email address" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-14 bg-gray-100/80 border-0 rounded-full px-6 text-base focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:bg-white transition-all placeholder:text-gray-400 font-medium"
                style={{ '--tw-ring-color': process.env.NEXT_PUBLIC_PRIMARY_COLOR } as any}
              />
            </div>
            
            <div className="space-y-1 relative">
              <Input 
                id="password" 
                type="password" 
                placeholder="Password"
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-14 bg-gray-100/80 border-0 rounded-full px-6 pr-12 text-base focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:bg-white transition-all placeholder:text-gray-400 font-medium"
                style={{ '--tw-ring-color': process.env.NEXT_PUBLIC_PRIMARY_COLOR } as any}
              />
            </div>

            <Button 
              className="w-full h-14 rounded-full text-lg font-bold shadow-lg mt-8 hover:opacity-90 transition-opacity" 
              type="submit" 
              disabled={loading}
              style={{ backgroundColor: process.env.NEXT_PUBLIC_PRIMARY_COLOR, color: getContrastColor(process.env.NEXT_PUBLIC_PRIMARY_COLOR) }}
            >
              {loading ? "Signing in..." : "Start"}
            </Button>
          </form>
          
          <div className="mt-10 text-gray-500 font-medium text-sm">
            Lost password? <span className="text-gray-900 font-bold cursor-pointer">Reset it</span>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Image Area */}
      <div className="hidden lg:block w-1/2 p-4 h-full relative">
        <div 
          className="w-full h-full rounded-[2rem] overflow-hidden bg-cover bg-center shadow-inner relative"
          style={{ backgroundImage: `url(${bgImage})` }}
        >
          {/* Subtle overlay to ensure the image looks good */}
          <div className="absolute inset-0 bg-black/10 mix-blend-multiply"></div>
          
          {/* Optional decorative tooltips similar to the reference */}
          <div className="absolute top-1/4 left-1/4 bg-white/30 backdrop-blur-md text-white px-4 py-2 rounded-2xl border border-white/20 text-sm shadow-xl font-medium">
            Manage Outlets
          </div>
          <div className="absolute bottom-1/3 right-1/4 bg-white/30 backdrop-blur-md text-white px-4 py-2 rounded-2xl border border-white/20 text-sm shadow-xl font-medium">
            Track Sales
          </div>
        </div>
      </div>
    </div>
  );
}
