import React, { useState } from 'react';
import HomePage from './components/HomePage.jsx';
import Login from './components/Login.jsx'
import './styles/app.css'

const App = () => {
  const [isLogged, setIsLogged] = useState(false);
  const updateLogged = (logged) => {
    setIsLogged(logged);
  };
  if (isLogged) {
    return (
      <div>
        <HomePage updateLogged={updateLogged}/>
      </div>
    );
  } else return (
    <div>
      <Login updateLogged={updateLogged}/>
    </div>
  )
};

export default App;