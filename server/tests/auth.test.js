process.env.JWT_SECRET = "unit-test-secret-that-is-at-least-32-characters";
delete process.env.GOOGLE_CLIENT_ID;

jest.mock("../models/User", () => ({
  create: jest.fn(),
  exists: jest.fn(),
  findById: jest.fn(),
  findOne: jest.fn(),
}));

const request = require("supertest");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { app } = require("../server");

const testSecret = process.env.JWT_SECRET;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.JWT_SECRET = testSecret;
  delete process.env.GOOGLE_CLIENT_ID;
});

describe("API and authentication routes", () => {
  test("GET / reports that the API is running", async () => {
    const response = await request(app).get("/");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "EduAlert API is running" });
  });

  test("registration rejects missing required fields", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({ username: "student1" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Complete all required fields");
    expect(User.create).not.toHaveBeenCalled();
  });

  test("registration rejects invalid username, email, or password", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Student",
        username: "x",
        email: "not-an-email",
        password: "short",
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/valid name, email, username, and a password/);
    expect(User.create).not.toHaveBeenCalled();
  });

  test("registration creates a normalized student account and returns a token", async () => {
    User.exists.mockResolvedValue(null);
    User.create.mockImplementation(async (account) => ({ ...account, id: "student-123" }));

    const response = await request(app)
      .post("/api/auth/register")
      .send({
        name: "  Ada Student ",
        username: "Ada_Student",
        email: "ADA@example.com",
        password: "strong-password",
      });

    expect(response.status).toBe(201);
    expect(response.body.user).toEqual({
      id: "student-123",
      name: "Ada Student",
      username: "ada_student",
      email: "ada@example.com",
      role: "student",
    });
    expect(response.body).not.toHaveProperty("user.passwordHash");
    expect(jwt.verify(response.body.token, testSecret).sub).toBe("student-123");
    expect(User.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Ada Student",
        username: "ada_student",
        email: "ada@example.com",
        role: "student",
      })
    );
    expect(User.create.mock.calls[0][0].passwordHash).not.toBe("strong-password");
  });

  test("login rejects requests without username and password", async () => {
    const response = await request(app).post("/api/auth/login").send({ username: "student1" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Enter your username and password");
    expect(User.findOne).not.toHaveBeenCalled();
  });

  test("login rejects an unknown username", async () => {
    User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

    const response = await request(app)
      .post("/api/auth/login")
      .send({ username: "unknown", password: "password123" });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Incorrect username or password");
  });

  test("Google login reports when OAuth is not configured", async () => {
    const response = await request(app)
      .post("/api/auth/google")
      .send({ credential: "valid-looking-token" });

    expect(response.status).toBe(503);
    expect(response.body.message).toBe("Google sign-in is not configured");
  });

  test("protected profile route rejects requests without a bearer token", async () => {
    const response = await request(app).get("/api/auth/me");

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Authentication required");
  });

  test("protected profile route returns the authenticated user's safe profile", async () => {
    const account = {
      id: "student-123",
      name: "Ada Student",
      username: "ada_student",
      email: "ada@example.com",
      role: "student",
      passwordHash: "never-return-this",
    };
    User.findById.mockResolvedValue(account);
    const token = jwt.sign({ sub: account.id }, testSecret);

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual({
      id: "student-123",
      name: "Ada Student",
      username: "ada_student",
      email: "ada@example.com",
      role: "student",
    });
    expect(response.body.user).not.toHaveProperty("passwordHash");
  });
});
