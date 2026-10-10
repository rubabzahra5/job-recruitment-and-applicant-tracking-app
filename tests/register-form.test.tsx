import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

import { RegisterForm } from "@/app/(public)/_components/RegisterForm";

/**
 * Registration form tests. The registerAction server action is mocked so the
 * component renders without a live Supabase backend.
 */

const mockRegisterAction = vi.fn();

vi.mock("@/app/(public)/register/actions", () => ({
  registerAction: (...args: unknown[]) => mockRegisterAction(...args),
}));

vi.mock("next/link", async () => {
  const ReactMod = await vi.importActual<typeof React>("react");
  return {
    default: ({ children, href }: { children: React.ReactNode; href: string }) =>
      ReactMod.createElement("a", { href }, children),
  };
});

function fillValid(overrides: Record<string, string> = {}) {
  const values = {
    name: "Ali Raza",
    email: "ali@example.com",
    password: "s3cur3pass",
    confirmPassword: "s3cur3pass",
    phone: "03001234567",
    ...overrides,
  };
  fireEvent.change(screen.getByLabelText(/full name/i), {
    target: { value: values.name },
  });
  fireEvent.change(screen.getByLabelText(/email address/i), {
    target: { value: values.email },
  });
  fireEvent.change(screen.getByLabelText(/^password/i), {
    target: { value: values.password },
  });
  fireEvent.change(screen.getByLabelText(/confirm password/i), {
    target: { value: values.confirmPassword },
  });
  fireEvent.change(screen.getByLabelText(/phone/i), {
    target: { value: values.phone },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRegisterAction.mockResolvedValue({ ok: true, pendingVerification: true });
});

describe("RegisterForm", () => {
  it("renders all fields and the submit button", () => {
    render(<RegisterForm defaultType="candidate" />);
    expect(screen.getByLabelText(/full name/i)).toBeTruthy();
    expect(screen.getByLabelText(/email address/i)).toBeTruthy();
    expect(screen.getByLabelText(/^password/i)).toBeTruthy();
    expect(screen.getByLabelText(/confirm password/i)).toBeTruthy();
    expect(screen.getByLabelText(/i am a/i)).toBeTruthy();
    expect(screen.getByLabelText(/phone/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /create account/i })).toBeTruthy();
  });

  it("shows validation errors for empty/invalid input", async () => {
    render(<RegisterForm defaultType="candidate" />);
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "A" } });
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "not-an-email" },
    });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText("Please enter your full name.")).toBeTruthy();
    expect(await screen.findByText("Enter a valid email address.")).toBeTruthy();
    expect(await screen.findByText("Password must be at least 8 characters.")).toBeTruthy();
    expect(mockRegisterAction).not.toHaveBeenCalled();
  });

  it("shows an error when passwords do not match", async () => {
    render(<RegisterForm defaultType="candidate" />);
    fillValid({ confirmPassword: "different-pass" });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText("Passwords do not match.")).toBeTruthy();
    expect(mockRegisterAction).not.toHaveBeenCalled();
  });

  it("submits valid input and shows the email-verification state", async () => {
    render(<RegisterForm defaultType="candidate" />);
    fillValid();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(mockRegisterAction).toHaveBeenCalledOnce());
    const payload = mockRegisterAction.mock.calls[0]![0] as Record<string, unknown>;
    expect(payload.name).toBe("Ali Raza");
    expect(payload.email).toBe("ali@example.com");
    expect(payload.accountType).toBe("candidate");

    expect(await screen.findByText("Check your inbox")).toBeTruthy();
    expect(screen.getByText(/ali@example.com/)).toBeTruthy();
  });

  it("displays server-side errors and field errors", async () => {
    mockRegisterAction.mockResolvedValue({
      ok: false,
      error: "An account with this email already exists.",
      fieldErrors: { email: "Email already registered." },
    });
    render(<RegisterForm defaultType="candidate" />);
    fillValid();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(
      await screen.findByText("An account with this email already exists."),
    ).toBeTruthy();
    expect(await screen.findByText("Email already registered.")).toBeTruthy();
  });
});
