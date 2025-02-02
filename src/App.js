import React, { useState } from 'react';
import HomePage from './components/HomePage.jsx';
import Login from './components/Login.jsx'
import './styles/app.css'

const App = () => {
  const [isLogged, setIslogged] = useState(false);
  if (isLogged) {
    return (
      <div>
        <HomePage />
      </div>
    );
  } else return (
    <div>
      <Login />
    </div>
  )
};

export default App;