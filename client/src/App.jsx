import { useState } from "react";

function App() {
  const [student, setStudent] = useState({
    name: "Arun Kumar",
    email: "arun@example.com",
    course: "Computer Science",
  });

  const [editing, setEditing] = useState(false);

  const handleChange = (event) => {
    setStudent({
      ...student,
      [event.target.name]: event.target.value,
    });
  };

  const handleUpdate = () => {
    setEditing(false);
    alert("Student details updated successfully!");
  };

  const handleDelete = () => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this student?"
    );

    if (confirmDelete) {
      setStudent(null);
    }
  };

  if (!student) {
    return (
      <div>
        <h1>EduAlert</h1>
        <p>Student record has been deleted.</p>
      </div>
    );
  }

  return (
    <div>
      <h1>EduAlert</h1>
      <h2>Student Details</h2>

      {editing ? (
        <div>
          <input
            type="text"
            name="name"
            value={student.name}
            onChange={handleChange}
          />

          <input
            type="email"
            name="email"
            value={student.email}
            onChange={handleChange}
          />

          <input
            type="text"
            name="course"
            value={student.course}
            onChange={handleChange}
          />

          <button onClick={handleUpdate}>Save Update</button>
        </div>
      ) : (
        <div>
          <p>
            <strong>Name:</strong> {student.name}
          </p>

          <p>
            <strong>Email:</strong> {student.email}
          </p>

          <p>
            <strong>Course:</strong> {student.course}
          </p>

          <button onClick={() => setEditing(true)}>Update</button>

          <button onClick={handleDelete}>Delete</button>
        </div>
      )}
    </div>
  );
}

export default App;