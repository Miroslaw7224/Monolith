import { describe, it, expect } from "vitest";
import { DomainError, ConflictError, NotFoundError } from "../../../lib/errors.js";

describe("lib/errors", () => {
  describe("DomainError", () => {
    it("given message and default statusCode, when constructed, then has name DomainError and statusCode 400", () => {
      const err = new DomainError("Invalid input");

      expect(err.name).toBe("DomainError");
      expect(err.message).toBe("Invalid input");
      expect(err.statusCode).toBe(400);
    });

    it("given message and custom statusCode, when constructed, then has given statusCode", () => {
      const err = new DomainError("Not found", 404);

      expect(err.name).toBe("DomainError");
      expect(err.message).toBe("Not found");
      expect(err.statusCode).toBe(404);
    });

    it("given DomainError is thrown, then it is an instance of Error", () => {
      const err = new DomainError("Test");

      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(DomainError);
    });
  });
});

describe("ConflictError", () => {
  it("is a DomainError with name ConflictError and statusCode 409", () => {
    const err = new ConflictError("File changed");
    expect(err).toBeInstanceOf(DomainError);
    expect(err.name).toBe("ConflictError");
    expect(err.statusCode).toBe(409);
    expect(err.message).toBe("File changed");
  });
});

describe("NotFoundError", () => {
  it("NotFoundError to DomainError z kodem 404", () => {
    const err = new NotFoundError("Nie ma projektu x");
    expect(err).toBeInstanceOf(DomainError);
    expect(err.statusCode).toBe(404);
    expect(err.name).toBe("NotFoundError");
  });
});
