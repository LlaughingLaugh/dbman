'use client'; // Needed for pathaname and client-side interactions like mobile menu

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PropsWithChildren, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, LayoutDashboard, Database, BarChart3, X } from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { href: '/dashboard/databases', label: 'Databases', icon: Database },
  { href: '/dashboard/insights', label: 'Insights', icon: BarChart3 },
];

export default function DashboardLayout({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const NavLinks = ({isMobile = false}: {isMobile?: boolean}) => (
    <nav className={`flex flex-col gap-2 ${isMobile ? 'p-4' : 'p-2'}`}>
      {navItems.map((item) => (
        <Button
          key={item.label}
          asChild
          variant={pathname.startsWith(item.href) ? 'secondary' : 'ghost'}
          className="justify-start"
          onClick={isMobile ? () => setMobileMenuOpen(false) : undefined}
        >
          <Link href={item.href}>
            <item.icon className="mr-2 h-4 w-4" />
            {item.label}
          </Link>
        </Button>
      ))}
    </nav>
  );


  return (
    <div className="flex min-h-screen w-full bg-muted/40">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex h-screen w-64 flex-col border-r bg-background fixed">
        <div className="flex h-16 items-center border-b px-6">
          <Link href="/dashboard/databases" className="flex items-center gap-2 font-semibold">
            <LayoutDashboard className="h-6 w-6" />
            <span>DB Dashboard</span>
          </Link>
        </div>
        <div className="flex-1 overflow-auto py-2">
            <NavLinks />
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 md:ml-64"> {/* Adjust margin to account for fixed sidebar */}
        {/* Header for Mobile */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 md:hidden">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button size="icon" variant="outline" className="md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="md:hidden w-64 p-0"> {/* Added p-0 to remove default padding if NavLinks has its own */}
              <div className="flex h-16 items-center border-b px-6">
                <Link href="/dashboard/databases" className="flex items-center gap-2 font-semibold" onClick={() => setMobileMenuOpen(false)}>
                  <LayoutDashboard className="h-6 w-6" />
                  <span>DB Dashboard</span>
                </Link>
                 <Button variant="ghost" size="icon" className="ml-auto" onClick={() => setMobileMenuOpen(false)}>
                    <X className="h-5 w-5" />
                    <span className="sr-only">Close menu</span>
                </Button>
              </div>
              <NavLinks isMobile={true} />
            </SheetContent>
          </Sheet>
           {/* Optional: Add breadcrumbs or page title here for mobile if needed */}
            <div className="flex-1">
                 <h1 className="font-semibold text-lg md:hidden ml-4">DB Dashboard</h1>
            </div>
        </header>

        <main className="flex-1 p-4 sm:px-6 sm:py-0 md:p-6 bg-muted/40">
          {children}
        </main>
      </div>
    </div>
  );
}
