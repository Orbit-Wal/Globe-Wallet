/**
 * BottomNav accessibility — Issue #24
 */
import * as React from "react";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { BottomNav } from "@/components/app/bottom-nav";
import { IntlTestProvider } from "../../test-utils/intl-provider";

const mockPathname = jest.fn(() => "/");

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

jest.mock("next/link", () => {
  return function MockLink({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  };
});

function renderBottomNav() {
  return render(
    <IntlTestProvider>
      <BottomNav />
    </IntlTestProvider>,
  );
}

describe("BottomNav accessibility (Issue #24)", () => {
  beforeEach(() => {
    mockPathname.mockReturnValue("/");
  });

  it("exposes navigation landmark with labeled links", () => {
    renderBottomNav();
    expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Send" })).not.toHaveAttribute("aria-current");
  });

  it("marks the active route with aria-current", () => {
    mockPathname.mockReturnValue("/send");
    renderBottomNav();
    expect(screen.getByRole("link", { name: "Send" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
  });

  it("supports keyboard focus on nav links", () => {
    renderBottomNav();
    const sendLink = screen.getByRole("link", { name: "Send" });
    sendLink.focus();
    expect(document.activeElement).toBe(sendLink);
  });

  it("has no axe violations", async () => {
    const { container } = renderBottomNav();
    expect(await axe(container)).toHaveNoViolations();
  });
});
