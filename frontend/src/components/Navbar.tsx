import { Link } from "react-router-dom";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { Menu } from "lucide-react";
import { Navigation } from "./Navigation";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background">
      <div className="w-full flex h-16 items-center justify-between py-4 px-4">
        <div className="flex items-center gap-2">
          <Sheet>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="outline" size="icon">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="border-r bg-background w-full h-full">
                <div className="space-y-4 py-4">
                  <div className="px-4 py-2">
                    <h2 className="mb-2 px-2 text-lg font-semibold tracking-tight">
                      Recruiter AI Agent
                    </h2>
                    <div className="space-y-1">
                      <Navigation className="flex flex-col" />
                    </div>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <Link to="/" className="flex items-center space-x-2">
            <span className="font-bold text-xl ml-2">Recruiter AI Agent</span>
          </Link>
        </div>
        <div className="flex items-center gap-6">
          {/* <Navigation className="hidden md:flex items-center space-x-4" /> */}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
