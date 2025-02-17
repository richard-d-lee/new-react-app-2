import React, { useState } from 'react';
import '../styles/Login.css';
import axios from 'axios';
import CreateAccount from './CreateAccount.jsx';

const Login = ({ updateLogged, updateEmail, email }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  if (creating) {
    return <CreateAccount setCreating={setCreating} />;
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); // Clear previous errors

    try {
      // The "email" field here can contain either an email or a username
      const response = await axios.post('http://localhost:5000/login', { email, password });
      
      if (response.data.token) {
        const token = response.data.token;
        // Store token securely
        localStorage.setItem('authToken', token);
        // Set default Axios header for authenticated requests
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        updateEmail(email);
        updateLogged(true);
      } else {
        setError('Login failed. Please try again.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    }
  };

  return (
    <div className="login-container">
      <h2>Login to Buz</h2>
      <form onSubmit={handleLogin} className="login-form">
        <div className="input-group">
          <label htmlFor="login">Email or Username</label>
          <input
            id="login"
            type="text"
            placeholder="Enter your email or username"
            value={email}
            onChange={(e) => updateEmail(e.target.value)}
            className="input"
            required
          />
        </div>
        <div className="input-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            required
          />
        </div>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="login-button">Login</button>
      </form>

      <div className="create-account-container">
        <p>Don't have an account?</p>
        <button onClick={() => setCreating(true)} className="create-account-button">
          Create Account
        </button>
      </div>
    </div>
  );
};

export default Login;
