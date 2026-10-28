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
  }

  if (busy && !user && !form.username) {
    return <main className="loading-screen" aria-live="polite"><span className="brand-mark">E</span><p>Opening your student space...</p></main>
  }

  if (user) {
    return (
      <main className="signed-in-shell">
        <header className="signed-in-header">
          <a className="brand" href="/" aria-label="EduAlert home"><span className="brand-mark">E</span><span>EduAlert</span></a>
          <button className="text-button" type="button" onClick={signOut}>Sign out</button>
        </header>
        <section className="welcome-panel" aria-labelledby="welcome-title">
          <p className="eyebrow">YOUR STUDENT SPACE</p>
          <div className="welcome-avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</div>
          <h1 id="welcome-title">Welcome, {user.name.split(' ')[0]}.</h1>
          <p className="welcome-copy">You are signed in and ready to continue.</p>
          <dl className="account-details">
            <div><dt>Username</dt><dd>@{user.username}</dd></div>
            <div><dt>Email</dt><dd>{user.email}</dd></div>
            <div><dt>Account</dt><dd>{user.role}</dd></div>
          </dl>
          <section className="ai-section" aria-labelledby="ai-title">
            <div className="file-section-heading">
              <div><p className="eyebrow">AI WRITING ASSISTANT</p><h2 id="ai-title">Continue your reflection</h2></div>
              <span className="ai-badge" aria-hidden="true">AI</span>
            </div>
            <p className="file-intro">Start with a thought about your learning, and AI can suggest a short continuation.</p>
            <label className="ai-field">
              <span>Your reflection</span>
              <textarea
                aria-label="Your reflection"
                maxLength={2000}
                onChange={(event) => {
                  setReflection(event.target.value)
                  setCompletion('')
                  setAiMessage('')
                }}
                placeholder="I feel more confident about my studies when..."
                rows={4}
                value={reflection}
              />
            </label>
            <div className="ai-actions">
              <button className="upload-button" type="button" onClick={continueReflection} disabled={aiBusy || !reflection.trim()}>
                {aiBusy ? 'Thinking…' : 'Continue writing'}
              </button>
              <span className="ai-character-count">{reflection.length}/2,000</span>
            </div>
            <p className="ai-privacy-note">Your reflection is sent to the configured AI provider for a suggestion. Avoid including sensitive personal details.</p>
            {aiMessage && <p className="file-message" role="alert">{aiMessage}</p>}
            {completion && (
              <div className="ai-suggestion" aria-live="polite">
                <p>{completion}</p>
                <button className="download-button" type="button" onClick={useCompletion}>Use continuation</button>
              </div>
            )}
          </section>
          <section className="file-section" aria-labelledby="files-title">
            <div className="file-section-heading">
              <div><p className="eyebrow">YOUR DOCUMENTS</p><h2 id="files-title">Keep files close</h2></div>
              <span className="file-count">{files.length} {files.length === 1 ? 'file' : 'files'}</span>
            </div>
            <p className="file-intro">Upload academic documents for easy access later.</p>
            <form className="upload-form" onSubmit={handleFileUpload}>
              <label className="file-picker">
                <span>Choose a document</span>
                <input aria-label="Choose a document to upload" name="student-file" type="file" accept="application/pdf,image/png,image/jpeg" required />
              </label>
              <button className="upload-button" type="submit" disabled={uploading}>{uploading ? 'Uploading…' : 'Upload file'}</button>
            </form>
            <p className="file-hint">PDF, PNG, or JPEG · up to 5 MB</p>
            {fileMessage && <p className="file-message" role="status">{fileMessage}</p>}
            {files.length > 0
              ? <ul className="file-list">{files.map((file) => (
                <li key={file.id}>
                  <span className="file-type" aria-hidden="true">{file.contentType === 'application/pdf' ? 'PDF' : 'IMG'}</span>
                  <span className="file-details"><strong>{file.name}</strong><small>{(file.size / 1024).toFixed(0)} KB · {new Date(file.createdAt).toLocaleDateString()}</small></span>
                  <button className="download-button" type="button" onClick={() => downloadFile(file)}>Download</button>
                </li>
              ))}</ul>
              : <p className="empty-files">Your uploaded documents will appear here.</p>}
          </section>
        </section>
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
