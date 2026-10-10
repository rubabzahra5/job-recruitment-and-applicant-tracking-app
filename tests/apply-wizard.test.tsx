import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";

import {
  ApplyWizard,
  type WizardCv,
  type WizardJob,
  type WizardQuestion,
} from "@/app/(candidate)/candidate/apply/[jobSlug]/_components/ApplyWizard";

/**
 * ApplyWizard (job-apply wizard) tests. submitApplication is mocked so the
 * component renders without a live backend; the wizard's client-side step
 * gating (required questions, CV selection, consent) is exercised for real.
 */

const mockSubmitApplication = vi.fn();

vi.mock("@/app/(candidate)/candidate/apply/[jobSlug]/_actions", () => ({
  submitApplication: (...args: unknown[]) => mockSubmitApplication(...args),
}));

vi.mock("next/link", async () => {
  const ReactMod = await vi.importActual<typeof React>("react");
  return {
    default: ({ children, href }: { children: React.ReactNode; href: string }) =>
      ReactMod.createElement("a", { href }, children),
  };
});

const JOB: WizardJob = {
  title: "Senior React Developer",
  slug: "senior-react-developer",
  description: "Build our ATS.",
  responsibilities: null,
  qualifications: null,
  skills: ["React"],
  employment_type: "full_time",
  workplace: "on_site",
  salary_min: 150000,
  salary_max: 250000,
  salary_period: "monthly",
  salary_disclosed: true,
  deadline: null,
  experience_min_years: 3,
  experience_max_years: 5,
  education_level: null,
  is_fresh_graduate_ok: false,
  orgName: "Test Org",
  city: "Karachi",
  province: "Sindh",
  categoryName: "Engineering",
};

const QUESTIONS: WizardQuestion[] = [
  { id: "q-required", question: "Why do you want this job?", is_required: true },
  { id: "q-optional", question: "Anything else to add?", is_required: false },
];

const CVS: WizardCv[] = [
  {
    id: "cv-1",
    file_name: "ali-cv.pdf",
    is_current_cv: true,
    created_at: "2026-10-01T00:00:00Z",
  },
];

function renderWizard() {
  render(
    <ApplyWizard
      job={JOB}
      questions={QUESTIONS}
      cvs={CVS}
      candidateName="Ali Raza"
    />,
  );
}

/** Walk to the questions step. */
function goToQuestions() {
  fireEvent.click(screen.getByRole("button", { name: /continue to questions/i }));
}

/** Answer the required question and advance to the CV step. */
async function answerAndContinue() {
  fireEvent.change(screen.getByLabelText(/why do you want this job/i), {
    target: { value: "I love building products." },
  });
  fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
  await screen.findByText(/select the cv to attach/i);
}

/** Advance CV → review step. */
async function goToReview() {
  fireEvent.click(screen.getByRole("button", { name: /review application/i }));
  await screen.findByText(/review & submit/i);
}

beforeEach(() => {
  vi.clearAllMocks();
  window.scrollTo = (() => {}) as typeof window.scrollTo;
  mockSubmitApplication.mockResolvedValue({ ok: true, applicationId: "app-1" });
});

describe("ApplyWizard — step gating", () => {
  it("renders the job review step first", () => {
    renderWizard();
    expect(screen.getByText("Senior React Developer")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /continue to questions/i }),
    ).toBeTruthy();
  });

  it("blocks Continue when a required question is unanswered", async () => {
    renderWizard();
    goToQuestions();
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));

    expect(await screen.findByText("This question is required.")).toBeTruthy();
    // Still on the questions step.
    expect(screen.queryByText(/select the cv to attach/i)).toBeNull();
    expect(mockSubmitApplication).not.toHaveBeenCalled();
  });

  it("advances once the required question is answered", async () => {
    renderWizard();
    goToQuestions();
    await answerAndContinue();
    // CV step shows the radio for the uploaded CV.
    expect(screen.getByText("ali-cv.pdf")).toBeTruthy();
  });

  it("warns when no CV exists", async () => {
    render(
      <ApplyWizard job={JOB} questions={QUESTIONS} cvs={[]} candidateName="Ali Raza" />,
    );
    goToQuestions();
    fireEvent.change(screen.getByLabelText(/why do you want this job/i), {
      target: { value: "x" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    expect(await screen.findByText(/no cv uploaded/i)).toBeTruthy();
  });
});

describe("ApplyWizard — review & submit", () => {
  it("requires consent before submitting", async () => {
    renderWizard();
    goToQuestions();
    await answerAndContinue();
    await goToReview();

    const submit = screen.getByRole("button", { name: /submit application/i });
    expect((submit as HTMLButtonElement).disabled).toBe(true);

    // Consent checkbox is the only checkbox on the review step.
    fireEvent.click(screen.getByRole("checkbox"));
    expect((submit as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(submit);
    await screen.findByText("Application submitted");
    expect(mockSubmitApplication).toHaveBeenCalledOnce();
    const payload = mockSubmitApplication.mock.calls[0]![0] as Record<string, unknown>;
    expect(payload.jobSlug).toBe("senior-react-developer");
    expect(payload.consent).toBe(true);
    expect(payload.documentId).toBe("cv-1");
  });

  it("shows the review summary before submitting", async () => {
    renderWizard();
    goToQuestions();
    await answerAndContinue();
    await goToReview();
    expect(screen.getByText(/senior react developer · test org/i)).toBeTruthy();
    expect(screen.getByText("ali-cv.pdf")).toBeTruthy();
  });

  it("surfaces the already-applied error from the server", async () => {
    mockSubmitApplication.mockResolvedValue({
      ok: false,
      code: "ALREADY_APPLIED",
      error: "You've already applied to this job.",
    });
    renderWizard();
    goToQuestions();
    await answerAndContinue();
    await goToReview();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /submit application/i }));

    expect(
      await screen.findByText(/you've already applied to this job/i),
    ).toBeTruthy();
    expect(screen.queryByText("Application submitted")).toBeNull();
  });

  it("surfaces generic server failures", async () => {
    mockSubmitApplication.mockResolvedValue({
      ok: false,
      error: "Database exploded.",
    });
    renderWizard();
    goToQuestions();
    await answerAndContinue();
    await goToReview();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /submit application/i }));

    expect(await screen.findByText("Database exploded.")).toBeTruthy();
  });
});
