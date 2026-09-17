import './globals.css';
import type { ReactNode } from 'react';
import AuthGate from './AuthGate';
import LedgerlyUxFixes from './LedgerlyUxFixes';
export const metadata={title:'Ledgerly — Family Expense Manager',description:'Shared family expenses, settlements and budgets.'};
export const viewport={width:'device-width',initialScale:1,viewportFit:'cover'};
export default function RootLayout({children}:{children:ReactNode}){return <html lang="en-IN"><body><LedgerlyUxFixes/><AuthGate>{children}</AuthGate></body></html>}
