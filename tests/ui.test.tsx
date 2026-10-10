import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

describe("Button", () => {
  it("renders children and handles disabled state", () => {
    render(<Button disabled>Save</Button>);
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn).toBeTruthy();
    expect(btn.hasAttribute("disabled")).toBe(true);
    expect(btn.getAttribute("aria-disabled")).toBe("true");
  });

  it("announces loading state", () => {
    render(<Button isLoading>Saving</Button>);
    const btn = screen.getByRole("button", { name: "Saving" });
    expect(btn.getAttribute("aria-busy")).toBe("true");
  });
});

describe("Alert", () => {
  it("uses role=alert", () => {
    render(<Alert tone="error">Something failed</Alert>);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Something failed");
  });
});

describe("Badge", () => {
  it("renders its label", () => {
    render(<Badge tone="success">Published</Badge>);
    expect(screen.getByText("Published")).toBeTruthy();
  });
});

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(<EmptyState title="No jobs yet" description="Check back later." />);
    expect(screen.getByText("No jobs yet")).toBeTruthy();
    expect(screen.getByText("Check back later.")).toBeTruthy();
  });
});
