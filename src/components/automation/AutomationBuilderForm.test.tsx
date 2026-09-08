import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AutomationBuilderForm } from "./AutomationBuilderForm";

vi.mock("@/hooks/useAutomations", () => ({
  useAutomationFlyers: () => ({ data: [] }),
  useAutomations: () => ({ data: [] }),
  useCreateAutomation: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useUpdateAutomation: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useActivateAutomation: () => ({ isPending: false, mutateAsync: vi.fn() }),
  usePublishAutomation: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

describe("AutomationBuilderForm", () => {
  it("presents the complete draft, publish, and activation lifecycle", () => {
    render(<AutomationBuilderForm onSaved={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Save draft" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Publish version/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Publish & activate/ })).toBeInTheDocument();
    expect(screen.getByText(/Only capabilities marked AVAILABLE can be published/)).toBeInTheDocument();
  });

  it("starts with one ordered safe action and supports adding another", () => {
    render(<AutomationBuilderForm onSaved={vi.fn()} />);
    expect(screen.getByText("Action 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add action" })).toBeInTheDocument();
  });
});
