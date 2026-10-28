process.env.JWT_SECRET = "unit-test-secret-that-is-at-least-32-characters";

jest.mock("../models/User", () => ({
  findById: jest.fn(),
}));

const request = require("supertest");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { app } = require("../server");

const testSecret = process.env.JWT_SECRET;
const originalFetch = global.fetch;
const originalOpenAiKey = process.env.OPENAI_API_KEY;

function authHeader() {
  const token = jwt.sign({ sub: "student-123" }, testSecret);
  return { Authorization: `Bearer ${token}` };
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.JWT_SECRET = testSecret;
  process.env.OPENAI_API_KEY = "test-openai-key";
  delete process.env.OPENAI_MODEL;
  User.findById.mockResolvedValue({
    id: "student-123",
    name: "Test Student",
    username: "test_student",
    email: "student@example.com",
    role: "student",
  });
  global.fetch = jest.fn();
});

afterAll(() => {
  global.fetch = originalFetch;
  if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalOpenAiKey;
  delete process.env.OPENAI_MODEL;
});

describe("POST /api/ai/autocomplete", () => {
  test("requires authentication", async () => {
    const response = await request(app)
      .post("/api/ai/autocomplete")
      .send({ text: "I am learning to..." });

    expect(response.status).toBe(401);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("rejects empty or oversized reflection text", async () => {
    const emptyResponse = await request(app)
      .post("/api/ai/autocomplete")
      .set(authHeader())
      .send({ text: "   " });
    const oversizedResponse = await request(app)
      .post("/api/ai/autocomplete")
      .set(authHeader())
      .send({ text: "a".repeat(2001) });

    expect(emptyResponse.status).toBe(400);
    expect(oversizedResponse.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("reports when the server-side AI key is missing", async () => {
    delete process.env.OPENAI_API_KEY;

    const response = await request(app)
      .post("/api/ai/autocomplete")
      .set(authHeader())
      .send({ text: "I am learning to..." });

    expect(response.status).toBe(503);
    expect(response.body.message).toBe("AI autocomplete is not configured");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("returns an AI continuation without exposing provider credentials", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "  ask questions when I need help." } }] }),
    });

    const response = await request(app)
      .post("/api/ai/autocomplete")
      .set(authHeader())
      .send({ text: "I am learning to" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ completion: "ask questions when I need help." });
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        headers: {
          Authorization: "Bearer test-openai-key",
          "Content-Type": "application/json",
        },
        body: expect.stringContaining('"model":"gpt-4o-mini"'),
      })
    );
    expect(response.body).not.toHaveProperty("apiKey");
  });

  test("returns an explicit error when the AI provider is unavailable", async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 503 });

    const response = await request(app)
      .post("/api/ai/autocomplete")
      .set(authHeader())
      .send({ text: "I am learning to..." });

    expect(response.status).toBe(502);
    expect(response.body.message).toBe("AI autocomplete is temporarily unavailable");
  });

  test("rejects an empty AI provider completion", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "  " } }] }),
    });

    const response = await request(app)
      .post("/api/ai/autocomplete")
      .set(authHeader())
      .send({ text: "I am learning to..." });

    expect(response.status).toBe(502);
    expect(response.body.message).toBe("AI autocomplete did not return a suggestion");
  });
});
