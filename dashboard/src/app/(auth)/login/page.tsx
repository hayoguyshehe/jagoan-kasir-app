"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
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
      const { data: userData, error: userError } = await insforge.database
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
    <Card>
      <CardHeader className="space-y-1 text-center">
        <CardTitle
          className="text-2xl font-bold tracking-tight"
          style={{ color: process.env.NEXT_PUBLIC_PRIMARY_COLOR }}
        >
          {brandName} Dashboard
        </CardTitle>
        <CardDescription>
          Enter your email and password to login to your account
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleLogin}>
        <CardContent className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-500 p-3 rounded-md text-sm">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="m@example.com" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input 
              id="password" 
              type="password" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            className="w-full" 
            type="submit" 
            disabled={loading}
            style={{ backgroundColor: process.env.NEXT_PUBLIC_PRIMARY_COLOR }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
