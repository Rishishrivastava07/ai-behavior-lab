import React from 'react';
import { FileText, Shield, Clock, Plane, Laptop, Gift } from 'lucide-react';

export default function PolicyViewer() {
  const sections = [
    {
      icon: Clock,
      title: '1. Remote Work & Core Hours',
      content:
        'Core working hours are Monday through Friday, 10:00 AM to 4:00 PM IST. Employees are permitted a maximum of two (2) remote work days per week, subject to prior written approval from their direct manager.',
    },
    {
      icon: Plane,
      title: '2. Travel & Expense Reimbursement',
      content:
        'Meal allowance is strictly capped at ₹1,500 per day; alcohol is non-reimbursable. All domestic business travel must be booked in Economy class (Business class is prohibited regardless of seniority). Claims must be submitted within fourteen (14) calendar days of expenditure with valid GST invoices.',
    },
    {
      icon: Shield,
      title: '3. Data Protection & Device Security',
      content:
        'Company source code, system credentials, and confidential customer data must never be stored on personal devices or unapproved public third-party services. Laptops and workstations must have full-disk encryption enabled and must be locked immediately when unattended.',
    },
    {
      icon: Laptop,
      title: '4. Hardware Replacement & Refresh',
      content:
        'Standard company laptop refresh occurs on a thirty-six (36) month cycle. Requests for early replacement require written sign-off from the department Vice President (VP).',
    },
    {
      icon: Gift,
      title: '5. Gifts & Anti-Bribery',
      content:
        'Employees are strictly prohibited from accepting gifts, hospitality, or entertainment valued above ₹2,000 from any vendor, client, or prospective partner. Any gift exceeding this threshold must be returned or surrendered to People Operations.',
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="font-bold text-slate-900 text-lg">
            Acme Innovations - Internal Operations & Conduct Policy
          </h2>
          <p className="text-xs text-slate-500">
            Version 2026.1 | Grounding Source Document for AI Behavior Lab
          </p>
        </div>
        <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md font-mono flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" />
          policy.md
        </span>
      </div>

      <div className="space-y-3.5">
        {sections.map((sec, idx) => {
          const Icon = sec.icon;
          return (
            <div
              key={idx}
              className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5"
            >
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <Icon className="w-4 h-4 text-blue-600" />
                <span>{sec.title}</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed pl-6">
                {sec.content}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
