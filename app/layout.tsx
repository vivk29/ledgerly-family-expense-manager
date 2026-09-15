import './globals.css';
import type { ReactNode } from 'react';
export const metadata={title:'Ledgerly — Family Expense Manager',description:'Shared family expenses, settlements and budgets.'};
export default function RootLayout({children}:{children:ReactNode}){return <html lang="en-IN"><body>{children}</body></html>}