process.env.JWT_SECRET = "unit-test-secret-that-is-at-least-32-characters";

jest.mock("../models/User", () => ({
  exists: jest.fn(),
  findById: jest.fn(),
}));
jest.mock("../models/Attendance", () => ({
  create: jest.fn(),
  find: jest.fn(),
  findById: jest.fn(),
}));
jest.mock("../models/Performance", () => ({
  create: jest.fn(),
  find: jest.fn(),
  findById: jest.fn(),
}));

const request = require("supertest");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Attendance = require("../models/Attendance");
const Performance = require("../models/Performance");
const { app } = require("../server");

const studentId = "65f000000000000000000001";
const testSecret = process.env.JWT_SECRET;

function authHeader(sub = studentId) {
  const token = jwt.sign({ sub }, testSecret);
  return { Authorization: `Bearer ${token}` };
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.JWT_SECRET = testSecret;
  User.findById.mockResolvedValue({
    id: studentId,
    name: "Test Student",
    username: "test_student",
    email: "student@example.com",
    role: "student",
  });
});

describe("student attendance tracking", () => {
  test("creates an owned attendance record and calculates its percentage", async () => {
    Attendance.create.mockImplementation(async (record) => ({ id: "attendance-1", ...record }));

    const response = await request(app)
      .post("/api/attendance")
      .set(authHeader())
      .send({
        subject: "  Mathematics ",
        totalClasses: 20,
        attendedClasses: 18,
        percentage: 1,
      });

    expect(response.status).toBe(201);
    expect(Attendance.create).toHaveBeenCalledWith({
      studentId,
      subject: "Mathematics",
      totalClasses: 20,
      attendedClasses: 18,
      percentage: 90,
    });
    expect(response.body.percentage).toBe(90);
  });

  test("rejects attendance counts when attended classes exceed total classes", async () => {
    const response = await request(app)
      .post("/api/attendance")
      .set(authHeader())
      .send({ subject: "Mathematics", totalClasses: 10, attendedClasses: 11 });

    expect(response.status).toBe(400);
    expect(Attendance.create).not.toHaveBeenCalled();
  });

  test("returns only the authenticated student's attendance records", async () => {
    const rows = [{ id: "attendance-1", subject: "Mathematics" }];
    Attendance.find.mockResolvedValue(rows);

    const response = await request(app)
      .get("/api/attendance")
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body).toEqual(rows);
    expect(Attendance.find).toHaveBeenCalledWith({ studentId });
  });

  test("recalculates the percentage when updating attendance", async () => {
    const record = {
      studentId,
      subject: "Mathematics",
      totalClasses: 10,
      attendedClasses: 8,
      percentage: 80,
      save: jest.fn().mockResolvedValue(undefined),
    };
    Attendance.findById.mockResolvedValue(record);

    const response = await request(app)
      .put("/api/attendance/attendance-1")
      .set(authHeader())
      .send({ totalClasses: 12, attendedClasses: 9, percentage: 100 });

    expect(response.status).toBe(200);
    expect(record.percentage).toBe(75);
    expect(record.save).toHaveBeenCalled();
  });

  test("prevents a student from updating another student's attendance", async () => {
    Attendance.findById.mockResolvedValue({
      studentId: "65f000000000000000000002",
      subject: "Mathematics",
      totalClasses: 10,
      attendedClasses: 8,
      save: jest.fn(),
    });

    const response = await request(app)
      .put("/api/attendance/attendance-2")
      .set(authHeader())
      .send({ attendedClasses: 9 });

    expect(response.status).toBe(403);
  });
});

describe("grade and project score tracking", () => {
  test("creates a project score for the authenticated student", async () => {
    Performance.create.mockImplementation(async (record) => ({ id: "score-1", ...record }));

    const response = await request(app)
      .post("/api/performance")
      .set(authHeader())
      .send({
        subject: "  Computing ",
        assessment: "Team build",
        category: "project",
        marks: 42,
        maxMarks: 50,
      });

    expect(response.status).toBe(201);
    expect(Performance.create).toHaveBeenCalledWith({
      studentId,
      subject: "Computing",
      assessment: "Team build",
      category: "project",
      marks: 42,
      maxMarks: 50,
    });
  });

  test("defaults a score to the grade category", async () => {
    Performance.create.mockImplementation(async (record) => ({ id: "score-2", ...record }));

    const response = await request(app)
      .post("/api/performance")
      .set(authHeader())
      .send({
        subject: "Mathematics",
        assessment: "Midterm",
        marks: 86,
        maxMarks: 100,
      });

    expect(response.status).toBe(201);
    expect(response.body.category).toBe("grade");
  });

  test("rejects scores above the maximum", async () => {
    const response = await request(app)
      .post("/api/performance")
      .set(authHeader())
      .send({
        subject: "Mathematics",
        assessment: "Midterm",
        category: "grade",
        marks: 101,
        maxMarks: 100,
      });

    expect(response.status).toBe(400);
    expect(Performance.create).not.toHaveBeenCalled();
  });

  test("returns only the authenticated student's scores in date order", async () => {
    const rows = [{ id: "score-1", category: "grade", marks: 86, maxMarks: 100 }];
    const sortedFind = { sort: jest.fn().mockResolvedValue(rows) };
    Performance.find.mockReturnValue(sortedFind);

    const response = await request(app)
      .get("/api/performance")
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body).toEqual(rows);
    expect(Performance.find).toHaveBeenCalledWith({ studentId });
    expect(sortedFind.sort).toHaveBeenCalledWith({ createdAt: -1 });
  });

  test("prevents a student from adding a score to another student's account", async () => {
    const response = await request(app)
      .post("/api/performance")
      .set(authHeader())
      .send({
        studentId: "65f000000000000000000002",
        subject: "Computing",
        assessment: "Team build",
        category: "project",
        marks: 42,
        maxMarks: 50,
      });

    expect(response.status).toBe(403);
    expect(Performance.create).not.toHaveBeenCalled();
  });

  test("allows faculty to record a score for a selected student", async () => {
    const facultyId = "65f000000000000000000003";
    User.findById.mockResolvedValue({
      id: facultyId,
      name: "Test Faculty",
      username: "test_faculty",
      email: "faculty@example.com",
      role: "faculty",
    });
    User.exists.mockResolvedValue({ _id: studentId });
    Performance.create.mockImplementation(async (record) => ({ id: "score-3", ...record }));

    const response = await request(app)
      .post("/api/performance")
      .set(authHeader(facultyId))
      .send({
        studentId,
        subject: "Computing",
        assessment: "Team build",
        category: "project",
        marks: 42,
        maxMarks: 50,
      });

    expect(response.status).toBe(201);
    expect(Performance.create).toHaveBeenCalledWith(expect.objectContaining({ studentId, category: "project" }));
    expect(User.exists).toHaveBeenCalledWith({ _id: studentId, role: "student" });
  });
});
