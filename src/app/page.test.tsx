import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("home page", () => {
  it("introduces the liquidity research workflow", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: "Map liquidity. Measure impact." }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Uniswap pool URL" }),
    ).toBeInTheDocument();
  });
});
