import { describe, expect, it, vi } from "vitest";
import { deleteAuthenticatedSession } from "../../../tests/e2e/authHelper.ts";

const response = (status, body = {}) => ({
  status: () => status,
  ok: () => status >= 200 && status < 300,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

const session = {
  password: "test-password",
  authState: { accessToken: "test-token", tokenType: "Bearer" },
};

const page = () => ({
  request: { delete: vi.fn(), get: vi.fn() },
  waitForTimeout: vi.fn().mockResolvedValue(undefined),
});

describe("E2E account cleanup", () => {
  it("retries a disconnected delete and confirms the test account is gone", async () => {
    const browserPage = page();
    browserPage.request.delete
      .mockRejectedValueOnce(new Error("apiRequestContext.delete: socket hang up"))
      .mockResolvedValueOnce(response(200, { deleted: true }));
    browserPage.request.get.mockResolvedValue(response(401));

    await deleteAuthenticatedSession(browserPage, session);

    expect(browserPage.request.delete).toHaveBeenCalledTimes(2);
    expect(browserPage.request.delete).toHaveBeenCalledWith(
      expect.stringContaining("/auth/account"),
      expect.objectContaining({
        headers: { Authorization: "Bearer test-token" },
        data: { password: "test-password" },
      }),
    );
    expect(browserPage.request.get).toHaveBeenCalledTimes(1);
  });

  it("accepts a 401 after an uncertain delete only when revocation is confirmed", async () => {
    const browserPage = page();
    browserPage.request.delete
      .mockRejectedValueOnce(new Error("socket hang up"))
      .mockResolvedValueOnce(response(401));
    browserPage.request.get.mockResolvedValue(response(401));

    await deleteAuthenticatedSession(browserPage, session);

    expect(browserPage.request.delete).toHaveBeenCalledTimes(2);
    expect(browserPage.request.get).toHaveBeenCalledTimes(1);
  });

  it("retries a disconnected revocation check", async () => {
    const browserPage = page();
    browserPage.request.delete.mockResolvedValue(response(200, { deleted: true }));
    browserPage.request.get
      .mockRejectedValueOnce(new Error("socket hang up"))
      .mockResolvedValueOnce(response(401));

    await deleteAuthenticatedSession(browserPage, session);

    expect(browserPage.request.delete).toHaveBeenCalledTimes(1);
    expect(browserPage.request.get).toHaveBeenCalledTimes(2);
  });

  it("does not retry an explicit deletion rejection", async () => {
    const browserPage = page();
    browserPage.request.delete.mockResolvedValue(response(403, { detail: "Forbidden" }));

    await expect(deleteAuthenticatedSession(browserPage, session)).rejects.toThrow("403");

    expect(browserPage.request.delete).toHaveBeenCalledTimes(1);
    expect(browserPage.request.get).not.toHaveBeenCalled();
  });

  it("fails after bounded retries without exposing the bearer token", async () => {
    const browserPage = page();
    browserPage.request.delete.mockRejectedValue(
      new Error("Authorization: Bearer secret-token\nCall log: Authorization: Bearer secret-token"),
    );

    await expect(deleteAuthenticatedSession(browserPage, session)).rejects.toThrow(
      "E2E account deletion transport failed after 3 attempts: Authorization: Bearer [REDACTED]",
    );
    expect(browserPage.request.delete).toHaveBeenCalledTimes(3);
    expect(browserPage.request.get).not.toHaveBeenCalled();
  });

  it("fails if the account still responds after deletion", async () => {
    const browserPage = page();
    browserPage.request.delete.mockResolvedValue(response(200, { deleted: true }));
    browserPage.request.get.mockResolvedValue(response(200));

    await expect(deleteAuthenticatedSession(browserPage, session)).rejects.toThrow(
      "Deleted E2E account remained accessible: 200",
    );
    expect(browserPage.request.get).toHaveBeenCalledTimes(1);
  });
});
