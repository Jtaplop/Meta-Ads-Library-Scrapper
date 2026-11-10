import { describe, it, expect } from "vitest";
import {
  formatBytes,
  formatDuration,
  formatDurationHuman,
  formatNumber,
} from "../format";

describe("format utilities", () => {
  it("formats bytes accurately", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1024 * 1024 * 3.5)).toBe("3.5 MB");
  });

  it("formats duration into digital format", () => {
    expect(formatDuration(0)).toBe("00:00");
    expect(formatDuration(161)).toBe("02:41");
    expect(formatDuration(3665)).toBe("01:01:05");
  });

  it("formats duration into human words", () => {
    expect(formatDurationHuman(161)).toBe("2 min 41 s");
  });

  it("formats numbers in Spanish locale", () => {
    const formatted = formatNumber(12500);
    // Spanish locale uses dot for thousands
    expect(formatted).toBe("12.500");
  });
});
