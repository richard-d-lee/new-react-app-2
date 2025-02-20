// GroupLogoUploader.jsx
import React, { useState } from 'react';
import axios from 'axios';
import { FaTimes } from 'react-icons/fa';
import '../styles/GroupLogoUploader.css';

const GroupLogoUploader = ({ token, groupId, onClose, onUploadSuccess }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a file to upload.');
      return;
    }
    const formData = new FormData();
    formData.append('groupLogo', selectedFile);
    try {
      const res = await axios.put(
        `http://localhost:5000/groups/${groupId}/logo`,
        formData,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } }
      );
      onUploadSuccess(res.data.logoUrl);
      onClose();
    } catch (err) {
      console.error('Error uploading group logo:', err);
      setError(err.response?.data?.error || 'Error uploading logo.');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="group-logo-uploader-modal">
        <button className="close-modal" onClick={onClose}>
          <FaTimes />
        </button>
        <h2>Update Group Logo</h2>
        {error && <p className="error-message">{error}</p>}
        <form onSubmit={handleUpload}>
          <input type="file" accept="image/*" onChange={handleFileChange} />
          <button type="submit">Upload</button>
        </form>
      </div>
    </div>
  );
};

export default GroupLogoUploader;
