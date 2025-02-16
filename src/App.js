import React, { useState, useEffect } from 'react';
import HomePage from './components/HomePage.jsx';
import Login from './components/Login.jsx';
import './styles/app.css';

const App = () => {
  const [isLogged, setIsLogged] = useState(false);
  const [email, setEmail] = useState('');

  // Check for an existing token on mount
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      setIsLogged(true);
      // Optionally, decode the token to get the email or other user info if needed.
      // For example:
      // const decoded = jwtDecode(token);
      // setEmail(decoded.email);
    }
  }, []);

  const updateLogged = (logged) => {
    setIsLogged(logged);
  };

  const updateEmail = (email) => {
    setEmail(email);
  };

  return (
    <div className="app">
      {isLogged ? (
        <HomePage updateLogged={updateLogged} email={email} />
      ) : (
        <Login updateLogged={updateLogged} updateEmail={updateEmail} email={email} />
      )}
    </div>
  );
};

export default App;
