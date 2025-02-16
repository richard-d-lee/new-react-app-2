import React from 'react';
import { FaSearch } from 'react-icons/fa';
import '../styles/SearchBar.css';

const SearchBar = () => {
  return (
    <div className="search-bar">
      <input type="text" placeholder="Search..." />
      <button className="search-button">
        <FaSearch />
      </button>
    </div>
  );
};

export default SearchBar;