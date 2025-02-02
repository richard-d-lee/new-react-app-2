import React, { useState } from 'react';
import '../styles/Login.css';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
  
    const handleLogin = (e) => {
      e.preventDefault();
      if (email === 'admin@admin.com' && password === 'password123') {
        alert('Login successful!');
        // You can redirect the user or perform other actions here
      } else {
        setError('Invalid email or password.');
      }
    };
  
    const handleCreateAccount = () => {
      alert('Redirecting to create account page...');
      // Redirect or show create account form (e.g., using React Router)
    };
  
    return (
      <div className="login-container">
        <h2>Login</h2>
        <form onSubmit={handleLogin} className="login-form">
          <div className="input-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              required
            />
          </div>
          <div className="input-group">
            <label>Password</label>
            <input
              type="password"
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
          <button onClick={handleCreateAccount} className="create-account-button">
            Create Account
          </button>
        </div>
      </div>
    );
  };
  
  export default Login;