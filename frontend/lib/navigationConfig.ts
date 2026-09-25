import { 
  LayoutDashboard, Users, CalendarCheck, BookOpen, 
  FileText, Wallet, Settings, Sparkles, GraduationCap, 
  HelpCircle, Trophy, Megaphone
} from "lucide-react";

export interface NavItem {
  name: string;
  nameBn: string;
  href: string;
  icon: any;
}

export interface NavGroup {
  title: string;
  titleBn: string;
  items: NavItem[];
}

export const schoolNavigation: NavGroup[] = [
  {
    title: "Classroom Operations",
    titleBn: "দৈনিক পাঠদান কার্যক্রম",
    items: [
      { name: "Overview", nameBn: "সারসংক্ষেপ", href: "/dashboard", icon: LayoutDashboard },
      { name: "Students Base", nameBn: "শিক্ষার্থী তালিকা", href: "/dashboard/students", icon: Users },
      { name: "Daily Attendance", nameBn: "দৈনিক হাজিরা", href: "/dashboard/attendance", icon: CalendarCheck },
      { name: "Class Timetable", nameBn: "ক্লাস রুটিন", href: "/dashboard/academic", icon: BookOpen },
    ]
  },
  {
    title: "Assessment & Academic",
    titleBn: "মূল্যায়ন ও প্রকাশনা",
    items: [
      { name: "Results & Grading", nameBn: "পরীক্ষার ফলাফল ও গ্রেডিং", href: "/dashboard/results", icon: Trophy },
      { name: "Question Papers", nameBn: "প্রশ্নপত্র প্রণয়ন (AI)", href: "/dashboard/exams", icon: BookOpen },
      { name: "Notice Composer", nameBn: "নোটিশ বোর্ড", href: "/dashboard/notices", icon: Megaphone },
    ]
  },
  {
    title: "Institution & Staff",
    titleBn: "প্রশাসন ও অর্থ",
    items: [
      { name: "Fee Ledger", nameBn: "ফি আদায় লেজার", href: "/dashboard/finance", icon: Wallet },
      { name: "Educators", nameBn: "শিক্ষক পরিষদ", href: "/dashboard/teachers", icon: GraduationCap },
      { name: "Teacher Diary AI", nameBn: "শিক্ষক ডায়েরি ও কারিকুলাম", href: "/dashboard/teacher-diary", icon: Sparkles },
    ]
  }
];

export const academyNavigation: NavGroup[] = [
  {
    title: "Academy Operations",
    titleBn: "একাডেমিক কেয়ার অপারেশন",
    items: [
      { name: "Overview", nameBn: "সারসংক্ষেপ", href: "/dashboard", icon: LayoutDashboard },
      { name: "Programs & Batches", nameBn: "কোর্স ও ব্যাচসমূহ", href: "/dashboard/batches", icon: Users },
      { name: "Live Exams", nameBn: "লাইভ এক্সাম ও ওএমআর", href: "/dashboard/live-exams", icon: Trophy },
      { name: "Shift Routine", nameBn: "শিফট শিডিউল", href: "/dashboard/academic", icon: BookOpen },
    ]
  },
  {
    title: "Learning Intelligence",
    titleBn: "লার্নিং স্টুডিও",
    items: [
      { name: "AI Doubt Solver", nameBn: "সক্রেটিক প্রবলেম সলভার", href: "/dashboard/doubt-solver", icon: HelpCircle },
      { name: "Question Bank", nameBn: "প্রশ্ন ব্যাংক ও এনালাইসিস", href: "/dashboard/exams", icon: BookOpen },
      { name: "Bulletins", nameBn: "জরুরি ঘোষণা", href: "/dashboard/notices", icon: Megaphone },
    ]
  },
  {
    title: "Administration",
    titleBn: "অ্যাকাউন্টস ও ফ্যাকাল্টি",
    items: [
      { name: "Payment Ledger", nameBn: "কোর্স ফি আদায়", href: "/dashboard/finance", icon: Wallet },
      { name: "Faculty Roster", nameBn: "ফ্যাকাল্টি প্যানেল", href: "/dashboard/teachers", icon: GraduationCap },
    ]
  }
];