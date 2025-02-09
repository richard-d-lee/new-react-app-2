import React, { useState } from 'react';
import HomePage from './components/HomePage.jsx';
import Login from './components/Login.jsx'
import './styles/app.css'

const App = () => {
  const [isLogged, setIsLogged] = useState(false);
  const [email, setEmail] = useState(localStorage.getItem('email'));
  const updateLogged = (logged) => {
    setIsLogged(logged);
  };
  const updateEmail = (email) => {
    setEmail(email);
  };
  const token = localStorage.getItem('authToken')
  if (isLogged || token) {
    return (
      <div>
        <HomePage updateLogged={updateLogged} email={email}/>
      </div>
    );
  } else return (
    <div>
      <Login updateLogged={updateLogged} updateEmail={updateEmail} email={email}/>
    </div>
  )
};

export default App;