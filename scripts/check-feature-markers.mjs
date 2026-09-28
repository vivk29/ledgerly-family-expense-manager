#!/usr/bin/env node
import fs from 'node:fs';

const checks = [
  ['GST tagging marker', 'app/page.tsx', 'gst_treatment'],
  ['CSV export marker', 'app/page.tsx', 'exportExpensesCsv'],
  ['Category edit marker', 'app/page.tsx', 'saveCategoryEdit'],
  ['Payment analytics marker', 'app/page.tsx', 'Payment method mix'],
  ['EMI payments schema marker', 'supabase/005_checklist_v1_finance_features.sql', 'emi_payments'],
  ['Income schedules schema marker', 'supabase/005_checklist_v1_finance_features.sql', 'income_schedules'],
];

let failed = false;
for (const [name, file, marker] of checks) {
  if (!fs.existsSync(file)) {
    console.error(`FAIL: ${name}: missing file ${file}`);
    failed = true;
    continue;
  }
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes(marker)) {
    console.error(`FAIL: ${name}: marker "${marker}" not found in ${file}`);
    failed = true;
  } else {
    console.log(`PASS: ${name}`);
  }
}

if (failed) process.exit(1);
