"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, LogOut, User } from "lucide-react";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sidebar } from "./sidebar";

export function Topbar() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  
  useEffect(() => {
    insforge.auth.getCurrentUser().then(({ data }) => {
      if (data.user) {
        setUserEmail(data.user.email || null);
      }
    });
  }, []);

  const handleLogout = async () => {
    await insforge.auth.signOut();
    document.cookie = 'insforge-auth-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    router.push("/login");
  };

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-white px-4 lg:px-6">
      <Sheet>
        {/* @ts-ignore */}
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="lg:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0">
          <Sidebar />
        </SheetContent>
      </Sheet>
      <div className="flex w-full justify-end">
        <DropdownMenu>
          {/* @ts-ignore */}
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarFallback>
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <span className="sr-only">Toggle user menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            {userEmail && <DropdownMenuItem disabled>{userEmail}</DropdownMenuItem>}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
