import { describe, it, expect, beforeEach } from "vitest";
import { RunStateMachine } from "./runStateMachine";
import { RunPoint } from "./types";

const point = (lat: number, lng: number, timestamp: number, accuracy = 10): RunPoint => ({
  lat,
  lng,
  accuracy,
  timestamp,
});

describe("RunStateMachine", () => {
  let sm: RunStateMachine;

  beforeEach(() => {
    sm = new RunStateMachine();
  });

  it("starts in IDLE", () => {
    expect(sm.getSnapshot().state).toBe("IDLE");
  });

  it("moves IDLE -> CALIBRATING -> RUNNING correctly", () => {
    sm.startCalibrating();
    expect(sm.getSnapshot().state).toBe("CALIBRATING");

    const anchor = point(12.9716, 77.5946, 1000);
    sm.beginRunning(anchor);
    const snap = sm.getSnapshot();
    expect(snap.state).toBe("RUNNING");
    expect(snap.startedAt).toBe(1000);
    expect(snap.lastAcceptedPoint).toEqual(anchor);
    expect(snap.routePoints).toHaveLength(1);
  });

  it("throws on an invalid transition", () => {
    // Can't pause from IDLE
    expect(() => sm.pause()).toThrow();
  });

  it("accrues distance and route points only while RUNNING", () => {
    sm.startCalibrating();
    sm.beginRunning(point(12.9716, 77.5946, 1000));

    sm.acceptPoint(point(12.97169, 77.5946, 6000), 11);
    expect(sm.getSnapshot().totalDistanceMeters).toBe(11);
    expect(sm.getSnapshot().routePoints).toHaveLength(2);

    sm.pause();
    // Even if something calls acceptPoint while paused, it must be ignored.
    sm.acceptPoint(point(12.9720, 77.5946, 12000), 999);
    expect(sm.getSnapshot().totalDistanceMeters).toBe(11); // unchanged
    expect(sm.getSnapshot().routePoints).toHaveLength(2); // unchanged
  });

  it("does not accrue duration while PAUSED", () => {
    sm.startCalibrating();
    sm.beginRunning(point(12.9716, 77.5946, 1000));

    sm.tickDuration(5000);
    expect(sm.getSnapshot().activeDurationMs).toBe(5000);

    sm.pause();
    sm.tickDuration(999999); // huge tick while paused must be ignored
    expect(sm.getSnapshot().activeDurationMs).toBe(5000);

    sm.resume();
    sm.tickDuration(2000);
    expect(sm.getSnapshot().activeDurationMs).toBe(7000);
  });

  it("clears lastAcceptedPoint on pause so resume doesn't create a phantom segment", () => {
    sm.startCalibrating();
    sm.beginRunning(point(12.9716, 77.5946, 1000));
    sm.acceptPoint(point(12.97169, 77.5946, 6000), 11);

    expect(sm.getSnapshot().lastAcceptedPoint).not.toBeNull();

    sm.pause();
    expect(sm.getSnapshot().lastAcceptedPoint).toBeNull();

    sm.resume();
    // Still null until a new point is actually accepted post-resume —
    // this is what prevents a big "distance" being computed across the pause gap.
    expect(sm.getSnapshot().lastAcceptedPoint).toBeNull();

    // Next accepted point becomes the new anchor with whatever delta the
    // caller computes (caller is responsible for treating it as delta 0,
    // since pointFilter.ts sees lastAccepted = null and returns delta 0).
    sm.acceptPoint(point(12.9720, 77.5946, 900000), 0);
    expect(sm.getSnapshot().totalDistanceMeters).toBe(11); // unchanged by the "gap"
    expect(sm.getSnapshot().lastAcceptedPoint).not.toBeNull();
  });

  it("allows finishing from both RUNNING and PAUSED", () => {
    sm.startCalibrating();
    sm.beginRunning(point(12.9716, 77.5946, 1000));
    sm.finish();
    expect(sm.getSnapshot().state).toBe("FINISHED");

    const sm2 = new RunStateMachine();
    sm2.startCalibrating();
    sm2.beginRunning(point(12.9716, 77.5946, 1000));
    sm2.pause();
    sm2.finish();
    expect(sm2.getSnapshot().state).toBe("FINISHED");
  });

  it("resets fully back to a fresh IDLE snapshot", () => {
    sm.startCalibrating();
    sm.beginRunning(point(12.9716, 77.5946, 1000));
    sm.acceptPoint(point(12.97169, 77.5946, 6000), 11);
    sm.finish();

    sm.reset();
    const snap = sm.getSnapshot();
    expect(snap.state).toBe("IDLE");
    expect(snap.totalDistanceMeters).toBe(0);
    expect(snap.activeDurationMs).toBe(0);
    expect(snap.routePoints).toHaveLength(0);
    expect(snap.startedAt).toBeNull();
  });

  it("notifies listeners on every state change", () => {
    const events: string[] = [];
    sm.onChange((snap) => events.push(snap.state));

    sm.startCalibrating();
    sm.beginRunning(point(12.9716, 77.5946, 1000));
    sm.pause();
    sm.resume();
    sm.finish();

    expect(events).toEqual(["CALIBRATING", "RUNNING", "PAUSED", "RUNNING", "FINISHED"]);
  });

  it("unsubscribes a listener correctly", () => {
    let callCount = 0;
    const unsubscribe = sm.onChange(() => callCount++);

    sm.startCalibrating();
    expect(callCount).toBe(1);

    unsubscribe();
    sm.beginRunning(point(12.9716, 77.5946, 1000));
    expect(callCount).toBe(1); // no further increments
  });
});