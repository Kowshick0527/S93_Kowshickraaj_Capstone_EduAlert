import Navbar from "./components/Navbar";
import DashboardCard from "./components/DashboardCard";
import AlertCard from "./components/AlertCard";
import Footer from "./components/Footer";

function App() {
  return (
    <>
      <Navbar />

      <main>
        <h1>Student Dashboard</h1>

        <DashboardCard title="Attendance" value="82%" />
        <DashboardCard title="Average Marks" value="76%" />
        <DashboardCard title="Assignments" value="8 / 10" />

        <AlertCard message="Your attendance in Mathematics is below the recommended level." />
      </main>

      <Footer />
    </>
  );
}

export default App;