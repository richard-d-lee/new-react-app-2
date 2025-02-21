import React, { useState } from 'react';
import '../styles/CreateAccount.css';

const CreateAccount = ({ setCreating }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [username, setUsername]   = useState('');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [verifyPassword, setVerifyPassword] = useState('');
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate passwords match
    if (password !== verifyPassword) {
      setError('Passwords do not match');
      setSuccess('');
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          firstName,
          lastName,
          username,
          email, 
          password 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message);
        // Clear all fields on success
        setFirstName('');
        setLastName('');
        setUsername('');
        setEmail('');
        setPassword('');
        setVerifyPassword('');
        setError('');
      } else {
        setError(data.error);
        setSuccess('');
      }
    } catch (err) {
      setError('Something went wrong');
      setSuccess('');
    }
  };

  return (
    <div className="create-account">
      <h2>Create Account</h2>
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      <form onSubmit={handleSubmit} className="create-account-form">
        <div className="form-group">
          <label htmlFor="first-name">First Name</label>
          <input
            id="first-name"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="last-name">Last Name</label>
          <input
            id="last-name"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="create-email">Email</label>
          <input
            id="create-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="create-password">Password</label>
          <input
            id="create-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="verify-password">Verify Password</label>
          <input
            id="verify-password"
            type="password"
            value={verifyPassword}
            onChange={(e) => setVerifyPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="submit-btn">Create Account</button>
      </form>
      <p className="toggle-login">
        Already have an account?{' '}
        <a onClick={() => setCreating(false)}>Login here</a>
      </p>
    </div>
  );
};

export default CreateAccount;
