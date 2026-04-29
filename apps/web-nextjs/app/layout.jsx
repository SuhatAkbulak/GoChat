import './globals.css';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata = {
  title: 'GoChat',
  description: 'GoChat Dashboard',
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr" className={cn("dark font-sans", geist.variable)}>
      <body>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
