/**
 * TalentBridge Assistant knowledge base.
 *
 * Plain data, no external AI: the assistant matches a visitor's question to
 * one of these entries with keyword scoring (see matcher.ts). Every link
 * points at a real route in the app. Keep answers short, friendly and
 * accurate — when in doubt, the assistant falls back to /faq and /contact
 * rather than guessing.
 */

export interface ChatLink {
  label: string;
  href: string;
}

export interface KnowledgeEntry {
  id: string;
  /** Canonical phrasing of the question this entry answers. */
  question: string;
  /** Words/phrases that signal this intent. Matched against the question. */
  keywords: string[];
  answer: string;
  links?: ChatLink[];
}

export const KNOWLEDGE: KnowledgeEntry[] = [
  {
    id: "what-is-talentbridge",
    question: "What is TalentBridge?",
    keywords: ["what is talentbridge", "about talentbridge", "what is this site", "what is this platform", "about this website", "who are you"],
    answer:
      "TalentBridge is a free job recruitment and applicant tracking platform built for Pakistan. Job seekers find real, verified jobs and track every application; employers post jobs and manage their whole hiring pipeline in one place — no ghost jobs, no silence, no fees.",
    links: [
      { label: "About TalentBridge", href: "/about" },
      { label: "Browse jobs", href: "/jobs" },
    ],
  },
  {
    id: "is-it-free",
    question: "Is TalentBridge free?",
    keywords: ["free", "cost", "price", "fees", "charge", "pay", "paid", "subscription", "premium"],
    answer:
      "Yes — TalentBridge is completely free for both job seekers and employers. No application fees, no posting fees, no commissions, no premium upsells. Free means free here.",
    links: [{ label: "Why TalentBridge is free", href: "/why-free" }],
  },
  {
    id: "find-jobs",
    question: "How do I find a job?",
    keywords: ["find job", "search job", "browse jobs", "looking for a job", "job search", "vacancies", "openings", "find work"],
    answer:
      "Head to the Jobs page and filter by keyword, category, city, salary range and workplace (on-site, hybrid or remote). You can also browse by category or city from the homepage.",
    links: [
      { label: "Browse jobs", href: "/jobs" },
      { label: "Jobs by category", href: "/categories" },
      { label: "Jobs by city", href: "/locations" },
    ],
  },
  {
    id: "apply-for-job",
    question: "How do I apply for a job?",
    keywords: ["apply", "how do i apply", "how to apply", "apply for a job", "submit application", "application process"],
    answer:
      "Open any job and press Apply. You'll need a free candidate account — the form is pre-filled from your profile, and you can attach your CV. Once submitted, you can track the application in your portal, and the company must respond within 7 business days.",
    links: [
      { label: "Browse jobs", href: "/jobs" },
      { label: "Create a candidate account", href: "/register?type=candidate" },
    ],
  },
  {
    id: "create-candidate-account",
    question: "How do I create a candidate (job seeker) account?",
    keywords: ["candidate account", "job seeker account", "sign up as candidate", "register as candidate", "create account job seeker", "join as candidate"],
    answer:
      "Choose 'I'm looking for a job' on the registration page, add your name, email and a password, and you're in. Then complete your profile and upload your CV so employers see the best version of you.",
    links: [{ label: "Register as a candidate", href: "/register?type=candidate" }],
  },
  {
    id: "create-employer-account",
    question: "How do I create an employer account?",
    keywords: ["employer account", "sign up as employer", "register company", "create company account", "hire staff", "register as employer"],
    answer:
      "Choose 'I'm hiring' on the registration page. After signing up you can create your organization (or join one you've been invited to), and once it's set up you can post jobs right away.",
    links: [{ label: "Register as an employer", href: "/register?type=employer" }],
  },
  {
    id: "roles",
    question: "What roles and account types are there?",
    keywords: ["roles", "account types", "user types", "recruiter", "hiring manager", "org admin", "who can use"],
    answer:
      "There are two sides: candidates (job seekers) and employers. Inside a company, team members can be organization admins, recruiters or hiring managers, each seeing what their role needs. A small platform team verifies companies and keeps the site safe.",
    links: [{ label: "Register", href: "/register" }],
  },
  {
    id: "post-a-job",
    question: "How do I post a job?",
    keywords: ["post a job", "post job", "publish job", "create job", "add vacancy", "advertise a job", "job posting"],
    answer:
      "Employers post jobs from their portal: Jobs → New job. Fill in the title, description, city, salary range (in PKR) and requirements, then publish. New companies and some postings are reviewed by our team first, which keeps fake jobs off the site.",
    links: [
      { label: "Register as an employer", href: "/register?type=employer" },
      { label: "Employer login", href: "/login" },
    ],
  },
  {
    id: "pipeline-stages",
    question: "What do the application stages mean?",
    keywords: ["pipeline", "stages", "stage meaning", "application stages", "hiring process steps", "what does shortlisted mean", "screening"],
    answer:
      "Every application moves through clear stages: Applied → Screening (the company is reviewing it) → Shortlisted → Assessment → Interview → Offer → Hired. If it doesn't work out you'll see Rejected — on TalentBridge you always get an answer, never silence.",
    links: [{ label: "Track my applications", href: "/candidate/applications" }],
  },
  {
    id: "response-rule",
    question: "What is the 5–7 business day response rule?",
    keywords: ["response rule", "response time", "7 business days", "5-7", "how long to respond", "deadline", "employer response time", "when will company respond", "how long wait reply"],
    answer:
      "Every company on TalentBridge must give each application a first response within 7 business days (Mon–Fri, Pakistan time) — moving it to In review, moving you forward, or a rejection all count. At 5 business days the employer gets a reminder. If the deadline passes with no reply, your application shows 'No response' and the company's public response rate drops.",
    links: [
      { label: "Pakistan-first protections", href: "/pakistan-first" },
      { label: "Track my applications", href: "/candidate/applications" },
    ],
  },
  {
    id: "response-rate-badge",
    question: "What is the response rate badge on companies and jobs?",
    keywords: ["response rate", "responds to", "badge meaning", "percentage applications", "response badge"],
    answer:
      "The 'Responds to X% of applications' badge is each company's real track record over the last 90 days. Only responses sent within the 7-business-day deadline count — late replies and ghosted applications lower the score. It appears once a company has at least 5 applications, so the number is meaningful.",
    links: [{ label: "Browse companies", href: "/companies" }],
  },
  {
    id: "ghost-jobs",
    question: "How does TalentBridge stop ghost jobs?",
    keywords: ["ghost job", "ghost jobs", "fake job", "scam job", "job not real", "jobs real", "are the jobs real", "inactive employer", "trust jobs real"],
    answer:
      "Three protections: companies are verified before their jobs go live; every company shows a public response rate based on on-time replies; and jobs from employers who go inactive are automatically paused after 14 days without activity. You can also report any suspicious job from its page.",
    links: [
      { label: "Pakistan-first features", href: "/pakistan-first" },
      { label: "Browse verified companies", href: "/companies" },
    ],
  },
  {
    id: "track-application",
    question: "How do I track my application?",
    keywords: ["track application", "track my application", "application status", "check my application", "where is my application", "my applications", "status of application"],
    answer:
      "Log in and open My Applications in your candidate portal. Each application shows its current stage and a 'Response due by' date — and if a company misses the deadline, you'll see 'No response from employer' instead of waiting forever.",
    links: [
      { label: "My applications", href: "/candidate/applications" },
      { label: "Log in", href: "/login" },
    ],
  },
  {
    id: "no-response",
    question: "What happens if a company never responds to my application?",
    keywords: ["no response", "company not responding", "no reply", "ghosted", "employer silent", "never heard back", "no answer"],
    answer:
      "If 7 business days pass with no response, your application is marked 'No response from employer', and the miss counts against the company's public response rate — repeated silence also pauses their job postings. You'll never be left guessing on TalentBridge.",
    links: [{ label: "My applications", href: "/candidate/applications" }],
  },
  {
    id: "withdraw-application",
    question: "How do I withdraw my application?",
    keywords: ["withdraw", "cancel application", "remove application", "take back application"],
    answer:
      "Open the application in your portal and use the Withdraw button. You can withdraw any time before the offer stages; the company is told you've withdrawn, and the application is closed politely.",
    links: [{ label: "My applications", href: "/candidate/applications" }],
  },
  {
    id: "saved-jobs",
    question: "How do saved jobs work?",
    keywords: ["saved jobs", "save job", "bookmark", "save for later", "favourite jobs"],
    answer:
      "Tap the bookmark on any job to save it for later. Your saved jobs live in your candidate portal so you can apply when you're ready — some jobs close, so don't wait too long!",
    links: [{ label: "My saved jobs", href: "/candidate/saved-jobs" }],
  },
  {
    id: "job-alerts",
    question: "How do job alerts work?",
    keywords: ["job alerts", "alerts", "email notifications new jobs", "notify me", "job notifications"],
    answer:
      "Create a job alert with your keywords, category or city, and we'll email you when matching jobs are posted. Alerts are free, and you can pause or delete them any time from your portal.",
    links: [{ label: "My job alerts", href: "/candidate/job-alerts" }],
  },
  {
    id: "profile-help",
    question: "How do I complete or improve my profile?",
    keywords: ["profile", "complete profile", "edit profile", "update profile", "headline", "skills", "my details"],
    answer:
      "Your profile page shows a completion meter. Add a clear headline, your city, skills, experience and education — complete profiles get noticed far more. Employers see this profile when you apply.",
    links: [{ label: "My profile", href: "/candidate/profile" }],
  },
  {
    id: "upload-cv",
    question: "How do I upload my CV?",
    keywords: ["upload cv", "upload resume", "add cv", "cv file", "resume file", "pdf cv"],
    answer:
      "Go to My CV & Resume in your portal and upload a PDF, DOC or DOCX file up to 5MB. Your current CV is attached to applications automatically, and you can replace it any time.",
    links: [{ label: "My CV & resume", href: "/candidate/resume" }],
  },
  {
    id: "resume-builder",
    question: "Can TalentBridge help me build a resume?",
    keywords: ["resume builder", "build resume", "create resume", "make cv", "cv builder", "resume template"],
    answer:
      "Yes — the built-in resume builder turns your profile into a clean resume you can download. Fill in your profile sections first, then generate it from the CV & Resume page.",
    links: [{ label: "My CV & resume", href: "/candidate/resume" }],
  },
  {
    id: "phone-verification",
    question: "Why and how do I verify my phone number?",
    keywords: ["verify phone", "verify phone number", "verify my phone", "phone number", "phone verification", "verified candidate", "phone number verify", "verification code"],
    answer:
      "A verified phone tells employers you're a real, reachable person, and it protects your account — one phone number can only be attached to one account. Start verification from your profile page and enter the code we send you.",
    links: [{ label: "My profile", href: "/candidate/profile" }],
  },
  {
    id: "org-verification",
    question: "What does the verified employer badge mean?",
    keywords: ["verified employer", "verified company", "verification badge", "company verification", "trusted employer"],
    answer:
      "A 'Verified employer' badge means our team has checked the company before letting it hire publicly. Combined with the response-rate badge, it helps you apply with confidence.",
    links: [{ label: "Browse companies", href: "/companies" }],
  },
  {
    id: "interviews-candidate",
    question: "How do interviews work?",
    keywords: ["interview", "interview scheduled", "interview invitation", "when is my interview", "interview details"],
    answer:
      "When a company schedules your interview, it appears on your application and in your notifications, with the date and time in Pakistan time. Check the application detail page for the full details before the day.",
    links: [
      { label: "My applications", href: "/candidate/applications" },
      { label: "Notifications", href: "/candidate/notifications" },
    ],
  },
  {
    id: "offers-candidate",
    question: "How do job offers work?",
    keywords: ["offer", "job offer", "received offer", "accept offer", "decline offer", "offer letter"],
    answer:
      "If a company makes you an offer, you'll find it on your application in the portal — you can review the terms and accept or decline there. Congratulations when it happens!",
    links: [{ label: "My applications", href: "/candidate/applications" }],
  },
  {
    id: "forgot-password",
    question: "I forgot my password. How do I reset it?",
    keywords: ["forgot password", "reset password", "can't log in", "cannot login", "locked out", "password reset", "forgot my password"],
    answer:
      "Use the forgot-password page and we'll email you a secure reset link. Follow it to set a new password, then log in as normal.",
    links: [{ label: "Reset my password", href: "/forgot-password" }],
  },
  {
    id: "login-help",
    question: "How do I log in?",
    keywords: ["log in", "login", "sign in", "signin", "access my account"],
    answer:
      "Use the Log in button at the top of the site with the email and password you registered with. New here? Creating an account is free and takes a minute.",
    links: [
      { label: "Log in", href: "/login" },
      { label: "Create an account", href: "/register" },
    ],
  },
  {
    id: "change-password",
    question: "How do I change my password or account settings?",
    keywords: ["change password", "account settings", "update email", "settings", "change my password"],
    answer:
      "You can manage your account from the Settings page in your portal. If you're locked out entirely, use the forgot-password flow instead.",
    links: [
      { label: "Candidate settings", href: "/candidate/settings" },
      { label: "Forgot password", href: "/forgot-password" },
    ],
  },
  {
    id: "contact-support",
    question: "How do I contact support or a human?",
    keywords: ["contact", "support", "help desk", "talk to human", "email you", "complaint", "customer service", "reach you"],
    answer:
      "Our team reads every message sent through the Contact page. Tell us what's wrong (or what you'd love to see) and we'll get back to you by email.",
    links: [{ label: "Contact us", href: "/contact" }],
  },
  {
    id: "privacy",
    question: "How is my personal data handled?",
    keywords: ["privacy", "my data", "personal data", "data protection", "who sees my profile", "safe data"],
    answer:
      "Your profile is only shown to employers you apply to — candidates never get public profiles on TalentBridge. We don't ask for CNIC, date of birth, marital status, photos or religion for ordinary applications. The full details are in the privacy policy.",
    links: [{ label: "Privacy policy", href: "/privacy" }],
  },
  {
    id: "terms",
    question: "Where are the terms of use?",
    keywords: ["terms", "terms of use", "terms and conditions", "rules", "agreement"],
    answer: "The terms of use explain everyone's rights and responsibilities on TalentBridge.",
    links: [{ label: "Terms of use", href: "/terms" }],
  },
  {
    id: "company-pages",
    question: "What can I see on a company page?",
    keywords: ["company page", "companies", "employer profile", "about company", "company details", "list of companies"],
    answer:
      "Each verified company has a public page with its story, industry, size, where it's hiring, its response-rate badge and all its open jobs — so you can research an employer before you apply.",
    links: [{ label: "Browse companies", href: "/companies" }],
  },
  {
    id: "why-free-page",
    question: "How can TalentBridge be free? What's the catch?",
    keywords: ["how is it free", "what's the catch", "business model", "how do you make money", "really free"],
    answer:
      "There's no catch. TalentBridge is built on free-tier technology and run lean, specifically so cost is never a barrier to hiring or job hunting in Pakistan. No fees are charged to candidates or employers for the core platform.",
    links: [{ label: "Why TalentBridge is free", href: "/why-free" }],
  },
  {
    id: "pakistan-first",
    question: "What are the Pakistan-first features?",
    keywords: ["pakistan first", "pakistan-first", "built for pakistan", "pakistani", "local features", "cnic", "load shedding", "disruption mode"],
    answer:
      "TalentBridge is designed for Pakistan: salaries in PKR, Pakistan time everywhere, hiring in Pakistani cities, a disruption mode that keeps hiring moving through outages and holidays, and a promise that ordinary applications never demand CNIC, photos or religion.",
    links: [{ label: "Pakistan-first", href: "/pakistan-first" }],
  },
  {
    id: "two-modes",
    question: "What are the two operating modes of TalentBridge?",
    keywords: ["two modes", "operating modes", "internal recruitment", "private mode", "portal mode", "own company system"],
    answer:
      "TalentBridge runs in two modes: as a public recruitment portal where many companies hire (what you're using now), or as a single organization's private, internal recruitment system. Same platform, configured for the organization's needs.",
    links: [{ label: "About TalentBridge", href: "/about" }],
  },
  {
    id: "report-job",
    question: "How do I report a suspicious job or company?",
    keywords: ["report", "report job", "report company", "suspicious", "fraud", "asking for money", "job scam"],
    answer:
      "Use the report option on the job's page, or contact us with the details. A real employer on TalentBridge will never ask you for money — if someone does, report it straight away and don't pay anything.",
    links: [{ label: "Contact us", href: "/contact" }],
  },
  {
    id: "salary-info",
    question: "How do salaries work on TalentBridge?",
    keywords: ["salary", "pay range", "salary filter", "how much does it pay", "pkr", "compensation"],
    answer:
      "Jobs show their salary range in Pakistani Rupees (PKR) whenever the employer provides one, and you can filter jobs by salary on the Jobs page so you only see roles in your range.",
    links: [{ label: "Browse jobs", href: "/jobs" }],
  },
  {
    id: "remote-jobs",
    question: "Can I find remote or hybrid jobs?",
    keywords: ["remote", "work from home", "hybrid", "wfh", "remote jobs", "online job"],
    answer:
      "Yes — use the workplace filter on the Jobs page to see remote-only or hybrid roles, including companies hiring remotely across Pakistan.",
    links: [{ label: "Browse jobs", href: "/jobs" }],
  },
  {
    id: "categories-page",
    question: "How do I browse jobs by category?",
    keywords: ["categories", "category", "field", "industry jobs", "sector", "browse by field"],
    answer:
      "The Categories page groups jobs by field — technology, education, healthcare, sales and more — with live counts of open roles in each.",
    links: [{ label: "Jobs by category", href: "/categories" }],
  },
  {
    id: "locations-page",
    question: "How do I find jobs in my city?",
    keywords: ["city", "location", "jobs in karachi", "jobs in lahore", "jobs in islamabad", "jobs near me", "my city", "locations"],
    answer:
      "The Locations page lists jobs by Pakistani city — Karachi, Lahore, Islamabad, Rawalpindi, Faisalabad, Multan, Peshawar, Quetta and more — and every job page shows exactly where the role is based.",
    links: [{ label: "Jobs by city", href: "/locations" }],
  },
  {
    id: "employer-manage-applications",
    question: "How do employers manage applications?",
    keywords: ["manage applications", "employer pipeline", "move candidate", "shortlist candidate", "reject candidate", "kanban", "board"],
    answer:
      "Employers get a full pipeline: a board and list of every application, drag-and-drop stage moves, bulk actions, team assignments and an application detail page for notes, interviews and offers. Every move updates the candidate instantly.",
    links: [{ label: "Employer login", href: "/login" }],
  },
  {
    id: "employer-response-duty",
    question: "As an employer, what are my response obligations?",
    keywords: ["employer deadline", "must respond", "employer obligation", "overdue applications", "days left", "countdown"],
    answer:
      "You must give every application a first response within 7 business days — moving it out of 'Applied' in any direction counts. Your portal shows countdown chips ('3 days left', 'Due today', 'Overdue') and a dashboard reminder banner. On-time responses build your public response rate; silence lowers it.",
    links: [{ label: "Employer login", href: "/login" }],
  },
  {
    id: "team-invites",
    question: "How do I invite my team to our organization?",
    keywords: ["invite team", "add team member", "team", "invite colleague", "organization members", "add recruiter"],
    answer:
      "Organization admins manage the team from the employer portal's Team page — invite colleagues by email and choose their role (admin, recruiter or hiring manager). Invited members get an email link to join.",
    links: [{ label: "Employer login", href: "/login" }],
  },
  {
    id: "status-meaning",
    question: "What does 'In review' mean on my application?",
    keywords: ["in review", "in review meaning", "under review", "being reviewed", "screening meaning", "what is screening"],
    answer:
      "'In review' (the Screening stage) means the company has opened your application and is considering it — they've met their first-response obligation. From there you may be shortlisted for an assessment or interview, or receive a polite rejection. Either way, you'll see it in your portal.",
    links: [{ label: "My applications", href: "/candidate/applications" }],
  },
  {
    id: "edit-application",
    question: "Can I edit my application after submitting?",
    keywords: ["edit application", "change application", "update application", "mistake in application", "wrong cv attached"],
    answer:
      "Applications can't be edited after submission — the employer sees exactly what you sent. If something important is wrong, you can withdraw and the employer is notified. Keeping your profile and CV up to date means future applications are always correct, since the form pre-fills from your profile.",
    links: [{ label: "My profile", href: "/candidate/profile" }],
  },
  {
    id: "faq-page",
    question: "Where can I read frequently asked questions?",
    keywords: ["faq", "frequently asked questions", "common questions", "help page", "questions"],
    answer: "Our FAQ page covers the most common questions from candidates and employers.",
    links: [{ label: "Read the FAQ", href: "/faq" }],
  },
  {
    id: "notifications",
    question: "How do notifications work?",
    keywords: ["notifications", "updates", "email updates", "how will i know", "alerts about application"],
    answer:
      "You'll get in-app notifications (and emails for the important moments) when your application moves stages, an interview is scheduled, or an offer arrives. Check the notifications bell in your portal any time.",
    links: [{ label: "My notifications", href: "/candidate/notifications" }],
  },
  {
    id: "greeting",
    question: "Hello / salam",
    keywords: ["hello", "hi", "salam", "assalam", "hey", "aoa", "good morning", "good afternoon"],
    answer:
      "Hello, and welcome to TalentBridge! I can help with finding jobs, applying, your account, employer questions, and our 5–7 business-day response rule. What would you like to know?",
    links: [{ label: "Browse jobs", href: "/jobs" }],
  },
];

export const CHAT_SUGGESTIONS: string[] = [
  "How do I apply?",
  "Post a job",
  "Is it free?",
  "Response time rule",
  "Track my application",
];

export const CHAT_FALLBACK =
  "I'm not sure about that one — I only answer questions about TalentBridge so I don't make things up. You might find it in our FAQ, or message our team and a human will help you.";
