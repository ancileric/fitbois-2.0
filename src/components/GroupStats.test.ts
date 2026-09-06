import { Goal } from "../types";
import { goalFraction } from "./GroupStats";

/**
 * The one thing worth pinning: a goal with no numbers is unmeasurable (null),
 * not zero. Averaging it in as zero is what made Dev read 0% and Imran 43%.
 */
const goal = (over: Partial<Goal>): Goal =>
  ({
    id: "g",
    userId: "u",
    category: "strength",
    description: "Bench 80kg for 5",
    baseline: "",
    target: "",
    isCompleted: false,
    proofs: [],
    createdDate: "2026-01-01",
    ...over,
  }) as Goal;

test("a goal with no numbers cannot be measured", () => {
  expect(goalFraction(goal({}))).toBeNull();
  expect(goalFraction(goal({ baselineValue: 60 }))).toBeNull();
});

test("numbers but no reading yet is a real zero, not unmeasurable", () => {
  expect(goalFraction(goal({ baselineValue: 60, targetValue: 80 }))).toBe(0);
});

test("progress is clamped between the baseline and the target", () => {
  const g = goal({ baselineValue: 60, targetValue: 80 });
  expect(goalFraction(g, 70)).toBe(0.5);
  expect(goalFraction(g, 50)).toBe(0);
  expect(goalFraction(g, 90)).toBe(1);
});

test("a ticked goal counts as done even without numbers", () => {
  expect(goalFraction(goal({ isCompleted: true }))).toBe(1);
});
