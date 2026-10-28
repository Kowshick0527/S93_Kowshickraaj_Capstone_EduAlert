import { useEffect, useState } from 'react'
import './App.css'

const emptyForm = { name: '', email: '', username: '', password: '' }
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

async function readResponse(response) {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.message || 'Something went wrong. Please try again.')
  return body
}

function App() {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState(emptyForm)
  const [user, setUser] = useState(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(() => Boolean(sessionStorage.getItem('edualert-token')))
  const [showPassword, setShowPassword] = useState(false)
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [fileMessage, setFileMessage] = useState('')
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [performanceRecords, setPerformanceRecords] = useState([])
  const [academicMessage, setAcademicMessage] = useState('')
  const [academicBusy, setAcademicBusy] = useState(false)
  const [attendanceForm, setAttendanceForm] = useState({ subject: '', totalClasses: '', attendedClasses: '' })
  const [scoreForm, setScoreForm] = useState({ subject: '', assessment: '', category: 'grade', marks: '', maxMarks: '' })
  const [facultyStudents, setFacultyStudents] = useState([])
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [reflection, setReflection] = useState('')
  const [completion, setCompletion] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiMessage, setAiMessage] = useState('')

  useEffect(() => {
    if (!user) return
    const token = sessionStorage.getItem('edualert-token')
    fetch('/api/files', { headers: { Authorization: `Bearer ${token}` } })
      .then(readResponse)
      .then(({ files: savedFiles }) => setFiles(savedFiles))
      .catch((error) => setFileMessage(error.message))
  }, [user])

  useEffect(() => {
    if (!user || user.role !== 'faculty') return
    const token = sessionStorage.getItem('edualert-token')
    fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } })
      .then(readResponse)
      .then((users) => {
        const students = users.filter((account) => account.role === 'student')
        setFacultyStudents(students)
        setSelectedStudentId(students[0]?.id || '')
      })
      .catch((error) => setAcademicMessage(error.message))
  }, [user])

  useEffect(() => {
    if (!user || (user.role === 'faculty' && !selectedStudentId)) return
    const token = sessionStorage.getItem('edualert-token')
    const query = user.role === 'faculty' ? `?studentId=${encodeURIComponent(selectedStudentId)}` : ''
    const headers = { Authorization: `Bearer ${token}` }
    Promise.all([
      fetch(`/api/attendance${query}`, { headers }).then(readResponse),
      fetch(`/api/performance${query}`, { headers }).then(readResponse),
    ])
      .then(([attendance, performance]) => {
        setAttendanceRecords(attendance)
        setPerformanceRecords(performance)
      })
      .catch((error) => setAcademicMessage(error.message))
  }, [user, selectedStudentId])

  async function refreshAcademicRecords() {
    const token = sessionStorage.getItem('edualert-token')
    const query = user.role === 'faculty' ? `?studentId=${encodeURIComponent(selectedStudentId)}` : ''
    const headers = { Authorization: `Bearer ${token}` }
    const [attendance, performance] = await Promise.all([
      fetch(`/api/attendance${query}`, { headers }).then(readResponse),
      fetch(`/api/performance${query}`, { headers }).then(readResponse),
    ])
    setAttendanceRecords(attendance)
    setPerformanceRecords(performance)
  }

  async function addAttendance(event) {
    event.preventDefault()
    setAcademicBusy(true)
    setAcademicMessage('')
    try {
      const token = sessionStorage.getItem('edualert-token')
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: attendanceForm.subject,
          totalClasses: Number(attendanceForm.totalClasses),
          attendedClasses: Number(attendanceForm.attendedClasses),
          ...(user.role === 'faculty' ? { studentId: selectedStudentId } : {}),
        }),
      })
      await readResponse(response)
      setAttendanceForm({ subject: '', totalClasses: '', attendedClasses: '' })
      await refreshAcademicRecords()
      setAcademicMessage('Attendance record saved.')
    } catch (error) {
      setAcademicMessage(error.message)
    } finally {
      setAcademicBusy(false)
    }
  }

  async function addScore(event) {
    event.preventDefault()
    setAcademicBusy(true)
    setAcademicMessage('')
    try {
      const token = sessionStorage.getItem('edualert-token')
      const response = await fetch('/api/performance', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: scoreForm.subject,
          assessment: scoreForm.assessment,
          category: scoreForm.category,
          marks: Number(scoreForm.marks),
          maxMarks: Number(scoreForm.maxMarks),
          ...(user.role === 'faculty' ? { studentId: selectedStudentId } : {}),
        }),
      })
      await readResponse(response)
      setScoreForm({ subject: '', assessment: '', category: 'grade', marks: '', maxMarks: '' })
      await refreshAcademicRecords()
      setAcademicMessage('Score saved.')
    } catch (error) {
      setAcademicMessage(error.message)
    } finally {
      setAcademicBusy(false)
    }
  }

  async function handleFileUpload(event) {
    event.preventDefault()
    const form = event.currentTarget
    const file = form.elements.namedItem('student-file').files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setFileMessage('Choose a file that is 5 MB or smaller.')
      return
    }

    setUploading(true)
    setFileMessage('')
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      let binary = ''
      for (let index = 0; index < bytes.length; index += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
      }
      const response = await fetch('/api/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem('edualert-token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: file.name, contentType: file.type, data: btoa(binary) }),
      })
      const { file: savedFile } = await readResponse(response)
      setFiles((current) => [savedFile, ...current])
      form.reset()
      setFileMessage('File uploaded successfully.')
    } catch (error) {
      setFileMessage(error.message)
    } finally {
      setUploading(false)
    }
  }

  async function continueReflection() {
    setAiBusy(true)
    setAiMessage('')
    setCompletion('')
    try {
      const response = await fetch('/api/ai/autocomplete', {
        method: 'POST',
        headers: {
          Authorization: `******'edualert-token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: reflection }),
      })
      const result = await readResponse(response)
      setCompletion(result.completion)
    } catch (error) {
      setAiMessage(error.message)
    } finally {
      setAiBusy(false)
    }
  }

  function useCompletion() {
    setReflection((current) => `${current}${current && !/\s$/.test(current) ? ' ' : ''}${completion}`)
    setCompletion('')
  }

  async function downloadFile(file) {
    setFileMessage('')
    try {
      const response = await fetch(`/api/files/${encodeURIComponent(file.id)}/download`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('edualert-token')}` },
      })
      if (!response.ok) await readResponse(response)
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = file.name
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      setFileMessage(error.message)
    }
  }

  async function handleGoogleCredential(credential) {
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      })
      const result = await readResponse(response)
      sessionStorage.setItem('edualert-token', result.token)
      setUser(result.user)
      setForm(emptyForm)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    const token = sessionStorage.getItem('edualert-token')
    if (!token) return

    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(readResponse)
      .then(({ user: account }) => setUser(account))
      .catch(() => sessionStorage.removeItem('edualert-token'))
      .finally(() => setBusy(false))
  }, [])

  useEffect(() => {
    if (!googleClientId) return

    let active = true
    const script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]')
      || document.createElement('script')
    const initializeGoogleButton = () => {
      const googleIdentity = window.google?.accounts?.id
      const button = document.getElementById('google-signin-button')
      if (!active || !googleIdentity || !button) return

      googleIdentity.initialize({
        client_id: googleClientId,
        callback: ({ credential }) => {
          if (!active) return
          if (credential) handleGoogleCredential(credential)
          else setMessage('Google sign-in did not return a credential. Please try again.')
        },
      })
      googleIdentity.renderButton(button, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        width: Math.floor(button.getBoundingClientRect().width),
      })
    }
    const handleScriptError = () => {
      if (active) setMessage('Google sign-in could not load. Please try again later.')
    }

    if (!window.google?.accounts?.id) {
      if (!script.parentNode) {
        script.src = 'https://accounts.google.com/gsi/client'
        script.async = true
        script.defer = true
        document.head.appendChild(script)
      }
      script.addEventListener('load', initializeGoogleButton)
      script.addEventListener('error', handleScriptError)
    } else {
      initializeGoogleButton()
    }

    return () => {
      active = false
      script.removeEventListener('load', initializeGoogleButton)
      script.removeEventListener('error', handleScriptError)
    }
  }, [])

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  function changeMode(nextMode) {
    setMode(nextMode)
    setMessage('')
    setShowPassword(false)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    const isRegistering = mode === 'register'
    const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login'
    const payload = isRegistering
      ? { name: form.name, email: form.email, username: form.username, password: form.password }
      : { username: form.username, password: form.password }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await readResponse(response)
      sessionStorage.setItem('edualert-token', result.token)
      setUser(result.user)
      setForm(emptyForm)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  function signOut() {
    sessionStorage.removeItem('edualert-token')
    setUser(null)
    setForm(emptyForm)
    setMode('login')
    setAttendanceRecords([])
    setPerformanceRecords([])
    setFacultyStudents([])
    setSelectedStudentId('')
  }

  if (busy && !user && !form.username) {
    return <main className="loading-screen" aria-live="polite"><span className="brand-mark">E</span><p>Opening your student space...</p></main>
  }

  if (user) {
    const grades = performanceRecords.filter((record) => (record.category || 'grade') === 'grade')
    const projects = performanceRecords.filter((record) => record.category === 'project')
    const attendanceBySubject = [...attendanceRecords.reduce((groups, record) => {
      const current = groups.get(record.subject) || { subject: record.subject, totalClasses: 0, attendedClasses: 0 }
      current.totalClasses += record.totalClasses
      current.attendedClasses += record.attendedClasses
      groups.set(record.subject, current)
      return groups
    }, new Map()).values()]
    const totalClasses = attendanceRecords.reduce((sum, record) => sum + record.totalClasses, 0)
    const attendedClasses = attendanceRecords.reduce((sum, record) => sum + record.attendedClasses, 0)
    const attendanceRate = totalClasses ? `${((attendedClasses / totalClasses) * 100).toFixed(1)}%` : '—'
    const scoreRate = (records) => {
      const marks = records.reduce((sum, record) => sum + record.marks, 0)
      const maxMarks = records.reduce((sum, record) => sum + record.maxMarks, 0)
      return maxMarks ? `${((marks / maxMarks) * 100).toFixed(1)}%` : '—'
    }
    const scorePercentage = (record) => (record.maxMarks ? (record.marks / record.maxMarks) * 100 : 0)
    const studentPicker = user.role === 'faculty' && (
      <label className="tracking-field">
        <span>Student</span>
        <select required value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)}>
          {!facultyStudents.length && <option value="">No students available</option>}
          {facultyStudents.map((student) => <option key={student.id} value={student.id}>{student.name} · @{student.username}</option>)}
        </select>
      </label>
    )

    return (
      <main className="signed-in-shell dashboard-shell">
        <header className="signed-in-header">
          <a className="brand" href="/" aria-label="EduAlert home"><span className="brand-mark">E</span><span>EduAlert</span></a>
          <div className="header-account">
            <span>{user.name} <small>{user.role}</small></span>
            <button className="text-button" type="button" onClick={signOut}>Sign out</button>
          </div>
        </header>
        <div className="dashboard-content">
          <section className="dashboard-intro" aria-labelledby="welcome-title">
            <div>
              <p className="eyebrow">{user.role === 'faculty' ? 'FACULTY PROGRESS OVERVIEW' : 'STUDENT PROGRESS OVERVIEW'}</p>
              <h1 id="welcome-title">Welcome, {user.name.split(' ')[0]}.</h1>
              <p>{user.role === 'faculty' ? 'Review student attendance, grades, and project results.' : 'Track attendance, grades, and project results in one place.'}</p>
            </div>
            <div className="welcome-avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</div>
          </section>

          {academicMessage && <p className="tracking-message" role="status">{academicMessage}</p>}

          <section className="metric-grid" aria-label="Academic progress summary">
            <article className="metric-card metric-attendance">
              <span className="metric-icon" aria-hidden="true">A</span>
              <p>Attendance rate</p>
              <strong>{attendanceRate}</strong>
              <small>{attendedClasses} of {totalClasses} classes attended</small>
            </article>
            <article className="metric-card metric-grades">
              <span className="metric-icon" aria-hidden="true">G</span>
              <p>Grade average</p>
              <strong>{scoreRate(grades)}</strong>
              <small>{grades.length} {grades.length === 1 ? 'assessment' : 'assessments'} recorded</small>
            </article>
            <article className="metric-card metric-projects">
              <span className="metric-icon" aria-hidden="true">P</span>
              <p>Project average</p>
              <strong>{scoreRate(projects)}</strong>
              <small>{projects.length} {projects.length === 1 ? 'project' : 'projects'} recorded</small>
            </article>
          </section>

          <section className="tracking-layout" aria-label="Academic records">
            <div className="tracking-main">
              <section className="tracking-panel" aria-labelledby="attendance-title">
                <div className="tracking-heading">
                  <div><p className="eyebrow">CLASS PARTICIPATION</p><h2 id="attendance-title">Attendance by subject</h2></div>
                  <span className="record-count">{attendanceBySubject.length} {attendanceBySubject.length === 1 ? 'subject' : 'subjects'}</span>
                </div>
                {attendanceBySubject.length
                  ? <ul className="attendance-list">{attendanceBySubject.map((record, index) => {
                    const rate = record.totalClasses ? (record.attendedClasses / record.totalClasses) * 100 : 0
                    return (
                      <li key={record.id || record._id || `${record.subject}-${index}`}>
                        <div className="attendance-record-heading">
                          <strong>{record.subject}</strong>
                          <span>{rate.toFixed(1)}%</span>
                        </div>
                        <div className="progress-track" role="progressbar" aria-label={`${record.subject} attendance`} aria-valuenow={Math.round(rate)} aria-valuemin="0" aria-valuemax="100">
                          <span style={{ width: `${Math.min(rate, 100)}%` }} />
                        </div>
                        <small>{record.attendedClasses} attended out of {record.totalClasses} classes</small>
                      </li>
                    )
                  })}</ul>
                  : <p className="tracking-empty">No attendance records yet. Add your first subject to start tracking.</p>}
              </section>

              <div className="score-panels">
                {[
                  { title: 'Grades and assessments', label: 'COURSE PERFORMANCE', records: grades, empty: 'No grades recorded yet.' },
                  { title: 'Project scores', label: 'PROJECT WORK', records: projects, empty: 'No project scores recorded yet.' },
                ].map((group) => (
                  <section className="tracking-panel score-panel" key={group.title}>
                    <div className="tracking-heading">
                      <div><p className="eyebrow">{group.label}</p><h2>{group.title}</h2></div>
                      <span className="record-count">{group.records.length}</span>
                    </div>
                    {group.records.length
                      ? <ul className="score-list">{group.records.map((record, index) => (
                        <li key={record.id || record._id || `${record.assessment}-${index}`}>
                          <div className="score-record-heading">
                            <span><strong>{record.assessment}</strong><small>{record.subject}</small></span>
                            <b>{record.marks}/{record.maxMarks}</b>
                          </div>
                          <div className="progress-track score-progress" role="progressbar" aria-label={`${record.assessment} score`} aria-valuenow={Math.round(scorePercentage(record))} aria-valuemin="0" aria-valuemax="100">
                            <span style={{ width: `${Math.min(scorePercentage(record), 100)}%` }} />
                          </div>
                          <small>{scorePercentage(record).toFixed(1)}%</small>
                        </li>
                      ))}</ul>
                      : <p className="tracking-empty">{group.empty}</p>}
                  </section>
                ))}
              </div>
            </div>

            <aside className="tracking-sidebar" aria-label="Add academic records">
              <section className="tracking-panel entry-panel">
                <p className="eyebrow">KEEP YOUR RECORDS CURRENT</p>
                <h2>Add attendance</h2>
                <form className="tracking-form" onSubmit={addAttendance}>
                  {studentPicker}
                  <label className="tracking-field"><span>Subject</span><input maxLength="100" onChange={(event) => setAttendanceForm((current) => ({ ...current, subject: event.target.value }))} placeholder="e.g. Mathematics" required value={attendanceForm.subject} /></label>
                  <div className="form-field-row">
                    <label className="tracking-field"><span>Attended</span><input min="0" onChange={(event) => setAttendanceForm((current) => ({ ...current, attendedClasses: event.target.value }))} required type="number" value={attendanceForm.attendedClasses} /></label>
                    <label className="tracking-field"><span>Total classes</span><input min="1" onChange={(event) => setAttendanceForm((current) => ({ ...current, totalClasses: event.target.value }))} required type="number" value={attendanceForm.totalClasses} /></label>
                  </div>
                  <button className="tracking-submit" type="submit" disabled={academicBusy || (user.role === 'faculty' && !selectedStudentId)}>{academicBusy ? 'Saving…' : 'Save attendance'}</button>
                </form>
              </section>

              <section className="tracking-panel entry-panel">
                <p className="eyebrow">ASSESSMENTS AND PROJECTS</p>
                <h2>Add a score</h2>
                <form className="tracking-form" onSubmit={addScore}>
                  {studentPicker}
                  <label className="tracking-field"><span>Record type</span><select value={scoreForm.category} onChange={(event) => setScoreForm((current) => ({ ...current, category: event.target.value }))}><option value="grade">Grade / assessment</option><option value="project">Project</option></select></label>
                  <label className="tracking-field"><span>Subject</span><input maxLength="100" onChange={(event) => setScoreForm((current) => ({ ...current, subject: event.target.value }))} placeholder="e.g. Computing" required value={scoreForm.subject} /></label>
                  <label className="tracking-field"><span>Assessment or project name</span><input maxLength="120" onChange={(event) => setScoreForm((current) => ({ ...current, assessment: event.target.value }))} placeholder="e.g. Midterm or Team build" required value={scoreForm.assessment} /></label>
                  <div className="form-field-row">
                    <label className="tracking-field"><span>Score</span><input min="0" onChange={(event) => setScoreForm((current) => ({ ...current, marks: event.target.value }))} required step="any" type="number" value={scoreForm.marks} /></label>
                    <label className="tracking-field"><span>Out of</span><input min="0.01" onChange={(event) => setScoreForm((current) => ({ ...current, maxMarks: event.target.value }))} required step="any" type="number" value={scoreForm.maxMarks} /></label>
                  </div>
                  <button className="tracking-submit" type="submit" disabled={academicBusy || (user.role === 'faculty' && !selectedStudentId)}>{academicBusy ? 'Saving…' : 'Save score'}</button>
                </form>
              </section>
            </aside>
          </section>

          <details className="secondary-tools">
            <summary>More tools and documents</summary>
            <div className="secondary-tools-content">
              <section className="ai-section" aria-labelledby="ai-title">
                <div className="file-section-heading">
                  <div><p className="eyebrow">AI WRITING ASSISTANT</p><h2 id="ai-title">Continue your reflection</h2></div>
                  <span className="ai-badge" aria-hidden="true">AI</span>
                </div>
                <p className="file-intro">Start with a thought about your learning, and AI can suggest a short continuation.</p>
                <label className="ai-field">
                  <span>Your reflection</span>
                  <textarea aria-label="Your reflection" maxLength={2000} onChange={(event) => {
                    setReflection(event.target.value)
                    setCompletion('')
                    setAiMessage('')
                  }} placeholder="I feel more confident about my studies when..." rows={4} value={reflection} />
                </label>
                <div className="ai-actions">
                  <button className="upload-button" type="button" onClick={continueReflection} disabled={aiBusy || !reflection.trim()}>{aiBusy ? 'Thinking…' : 'Continue writing'}</button>
                  <span className="ai-character-count">{reflection.length}/2,000</span>
                </div>
                <p className="ai-privacy-note">Your reflection is sent to the configured AI provider for a suggestion. Avoid including sensitive personal details.</p>
                {aiMessage && <p className="file-message" role="alert">{aiMessage}</p>}
                {completion && <div className="ai-suggestion" aria-live="polite"><p>{completion}</p><button className="download-button" type="button" onClick={useCompletion}>Use continuation</button></div>}
              </section>
              <section className="file-section" aria-labelledby="files-title">
                <div className="file-section-heading">
                  <div><p className="eyebrow">YOUR DOCUMENTS</p><h2 id="files-title">Keep files close</h2></div>
                  <span className="file-count">{files.length} {files.length === 1 ? 'file' : 'files'}</span>
                </div>
                <p className="file-intro">Upload academic documents for easy access later.</p>
                <form className="upload-form" onSubmit={handleFileUpload}>
                  <label className="file-picker"><span>Choose a document</span><input aria-label="Choose a document to upload" name="student-file" type="file" accept="application/pdf,image/png,image/jpeg" required /></label>
                  <button className="upload-button" type="submit" disabled={uploading}>{uploading ? 'Uploading…' : 'Upload file'}</button>
                </form>
                <p className="file-hint">PDF, PNG, or JPEG · up to 5 MB</p>
                {fileMessage && <p className="file-message" role="status">{fileMessage}</p>}
                {files.length
                  ? <ul className="file-list">{files.map((file) => (
                    <li key={file.id}>
                      <span className="file-type" aria-hidden="true">{file.contentType === 'application/pdf' ? 'PDF' : 'IMG'}</span>
                      <span className="file-details"><strong>{file.name}</strong><small>{(file.size / 1024).toFixed(0)} KB · {new Date(file.createdAt).toLocaleDateString()}</small></span>
                      <button className="download-button" type="button" onClick={() => downloadFile(file)}>Download</button>
                    </li>
                  ))}</ul>
                  : <p className="empty-files">Your uploaded documents will appear here.</p>}
              </section>
            </div>
          </details>
          <p className="dashboard-footer">EduAlert · Supporting informed academic progress</p>
        </div>
      </main>
    )
  }

  return (
    <main className="auth-shell">
      <section className="story-panel" aria-label="EduAlert">
        <a className="brand brand-light" href="/" aria-label="EduAlert home"><span className="brand-mark">E</span><span>EduAlert</span></a>
        <div className="story-copy">
          <p className="eyebrow">A CLEARER VIEW OF YOUR JOURNEY</p>
          <h1>Make room for<br /><em>what comes next.</em></h1>
          <p className="story-description">Your academic progress, with the space and support to keep moving forward.</p>
        </div>
        <div className="progress-graphic" aria-label="Illustration of academic progress">
          <div className="graphic-heading"><span>WEEKLY MOMENTUM</span><span className="graphic-status"><i /> ON TRACK</span></div>
          <div className="chart-area" aria-hidden="true">
            <div className="chart-lines"><i /><i /><i /></div>
            <div className="chart-bars"><i /><i /><i /><i /><i /><i /><i /></div>
            <div className="chart-days"><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span></div>
          </div>
          <div className="graphic-footer"><span>Consistency adds up.</span><b>+12%</b></div>
        </div>
        <p className="story-footnote">A steady step is still a step forward.</p>
      </section>

      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="auth-content">
          <div className="portal-label"><span className="portal-dot" /> STUDENT PORTAL</div>
          <div className="mode-switch" role="tablist" aria-label="Account access">
            <button className={mode === 'login' ? 'mode-tab active' : 'mode-tab'} type="button" role="tab" aria-selected={mode === 'login'} onClick={() => changeMode('login')}>Sign in</button>
            <button className={mode === 'register' ? 'mode-tab active' : 'mode-tab'} type="button" role="tab" aria-selected={mode === 'register'} onClick={() => changeMode('register')}>Create account</button>
          </div>
          <div className="form-heading">
            <h2 id="auth-title">{mode === 'login' ? 'Welcome back' : 'Start with an account'}</h2>
            <p>{mode === 'login' ? 'Sign in to pick up where you left off.' : 'Set up your EduAlert student account.'}</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === 'register' && <>
              <label className="field"><span>Full name</span><input autoComplete="name" maxLength="80" name="name" onChange={updateField} placeholder="e.g. Alex Morgan" required value={form.name} /></label>
              <label className="field"><span>Email address</span><input autoComplete="email" name="email" onChange={updateField} placeholder="you@college.edu" required type="email" value={form.email} /></label>
            </>}
            <label className="field">
              <span>Username</span>
              <input autoCapitalize="none" autoComplete="username" maxLength="32" minLength="3" name="username" onChange={updateField} placeholder="Your username" required value={form.username} />
            </label>
            <label className="field">
              <span>Password</span>
              <span className="password-control">
                <input autoComplete={mode === 'login' ? 'current-password' : 'new-password'} maxLength="72" minLength="8" name="password" onChange={updateField} placeholder="At least 8 characters" required type={showPassword ? 'text' : 'password'} value={form.password} />
                <button className="reveal-button" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? 'Hide' : 'Show'}</button>
              </span>
              {mode === 'register' && <small>Use 8 or more characters.</small>}
            </label>
            {message && <p className="form-error" role="alert">{message}</p>}
            <button className="submit-button" disabled={busy} type="submit"><span>{busy ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}</span><span aria-hidden="true">&#8594;</span></button>
          </form>

          <div className="google-signin-section">
            <div className="auth-divider"><span>or continue with</span></div>
            {googleClientId
              ? <div id="google-signin-button" aria-label="Sign in with Google" />
              : <p className="google-config-note">Set VITE_GOOGLE_CLIENT_ID to enable Google sign-in.</p>}
          </div>

          <p className="form-footnote">
            {mode === 'login' ? 'New to EduAlert?' : 'Already have an account?'}{' '}
            <button className="inline-link" type="button" onClick={() => changeMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button>
          </p>
          <p className="security-note"><span aria-hidden="true">&#9679;</span> Your account details stay private.</p>
        </div>
      </section>
    </main>
  )
}

export default App
