// @vitest-environment node
import { describe, it, expect } from "vitest";
import { GeoPoint, Timestamp } from "firebase-admin/firestore";
import {
  decodeValue,
  encodeValue,
  UnsupportedValueError,
} from "@/scripts/export-firestore/serialize";

describe("encodeValue", () => {
  it("passes primitives, arrays and plain objects through unchanged", () => {
    const input = { a: 1, b: "x", c: true, d: null, e: [1, "two", { f: 3 }] };
    expect(encodeValue(input)).toEqual(input);
  });

  it("tags a Timestamp with seconds, nanos and an ISO string", () => {
    const ts = new Timestamp(1767323045, 678000000);
    expect(encodeValue({ createdAt: ts })).toEqual({
      createdAt: {
        __type: "timestamp",
        iso: "2026-01-02T03:04:05.678Z",
        seconds: 1767323045,
        nanos: 678000000,
      },
    });
  });

  it("tags GeoPoint, bytes and non-finite numbers", () => {
    expect(encodeValue(new GeoPoint(52.1, 21.0))).toEqual({
      __type: "geopoint",
      latitude: 52.1,
      longitude: 21.0,
    });
    expect(encodeValue(Buffer.from("hi"))).toEqual({ __type: "bytes", base64: "aGk=" });
    expect(encodeValue(NaN)).toEqual({ __type: "number", value: "NaN" });
    expect(encodeValue(Infinity)).toEqual({ __type: "number", value: "Infinity" });
    expect(encodeValue(-Infinity)).toEqual({ __type: "number", value: "-Infinity" });
  });

  it("fails loudly on integers that JS cannot hold exactly", () => {
    expect(() => encodeValue({ big: 2 ** 60 }, "doc")).toThrow(UnsupportedValueError);
    expect(() => encodeValue({ big: 2 ** 60 }, "doc")).toThrow(/doc\.big/);
  });

  it("fails loudly on unknown class instances and undefined", () => {
    class Weird {}
    expect(() => encodeValue({ w: new Weird() })).toThrow(/Weird/);
    expect(() => encodeValue({ u: undefined })).toThrow(UnsupportedValueError);
  });

  it("fails on a reserved __type key in user data", () => {
    expect(() => encodeValue({ __type: "x" })).toThrow(UnsupportedValueError);
  });
});

describe("decodeValue", () => {
  it("restores a Timestamp to the nanosecond", () => {
    const ts = new Timestamp(1767323045, 678901234);
    const back = decodeValue(encodeValue({ t: ts })) as { t: Timestamp };
    expect(back.t.isEqual(ts)).toBe(true);
  });

  it("restores GeoPoint, bytes, NaN and nested structures", () => {
    const input = {
      g: new GeoPoint(1, 2),
      b: Buffer.from([1, 2, 3]),
      n: NaN,
      nested: [{ t: new Timestamp(10, 20) }],
    };
    const back = decodeValue(encodeValue(input)) as typeof input;
    expect(back.g.isEqual(input.g)).toBe(true);
    expect(Buffer.compare(back.b, input.b)).toBe(0);
    expect(Number.isNaN(back.n)).toBe(true);
    expect(back.nested[0].t.isEqual(input.nested[0].t)).toBe(true);
  });

  it("leaves reference tags untouched (a path, not a live reference)", () => {
    const tagged = { r: { __type: "reference", path: "users/u1/tasks/t" } };
    expect(decodeValue(tagged)).toEqual(tagged);
  });
});
