import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LiquidityChart } from "./liquidity-chart";

describe("LiquidityChart", () => {
  it("keeps dense range data inside the plotted area", () => {
    const bands = Array.from({ length: 1500 }, (_, index) => ({
      id: `${index}:${index + 1}`,
      tickLower: index,
      tickUpper: index + 1,
      lowerPrice: String(3900 + index),
      upperPrice: String(3901 + index),
      liquidity: String(1000 + index),
      active: index === 750,
    }));

    render(<LiquidityChart bands={bands} token1Symbol="USDC" />);

    const chart = screen.getByRole("img", { name: "Liquidity bands" });
    const bars = chart.querySelectorAll("rect");
    const lastBar = bars[bars.length - 1];
    const rightEdge =
      Number(lastBar.getAttribute("x")) + Number(lastBar.getAttribute("width"));

    expect(rightEdge).toBeLessThanOrEqual(720);
  });
});
