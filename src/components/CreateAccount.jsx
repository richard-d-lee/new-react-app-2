import React, { useState } from 'react';
import '../styles/CreateAccount.css';

const CreateAccount = ({setCreating}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verifyPassword, setVerifyPassword] = useState(''); // Added verify password state
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Check if passwords match
    if (password !== verifyPassword) {
      setError('Passwords do not match');
      setSuccess('');
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message);
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
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Email</label>
          <input 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
          />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
          />
        </div>
        <div className="form-group">
          <label>Verify Password</label>
          <input 
            type="password" 
            value={verifyPassword} 
            onChange={(e) => setVerifyPassword(e.target.value)} 
            required 
          />
        </div>
        <button type="submit" className="submit-btn">Create Account</button>
      </form>
      <p>
        Already have an account? <a onClick={() => {setCreating(false)}}>Login here</a>
      </p>
    </div>
  );
};

export default CreateAccount;
