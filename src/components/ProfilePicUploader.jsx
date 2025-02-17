import React, { useState } from 'react';
import axios from 'axios';
import '../styles/ProfilePicUploader.css';

const ProfilePicUploader = ({ token, onClose, onUploadSuccess }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('No file selected');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('profilePic', selectedFile);
      const res = await axios.post('http://localhost:5000/upload-profile-pic', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      if (res.data.fileUrl) {
        onUploadSuccess(res.data.fileUrl);
      } else {
        onUploadSuccess(null);
      }
    } catch (err) {
      console.error('Error uploading profile pic:', err);
      setError(err.response?.data?.error || 'Error uploading file');
    }
  };

  return (
    <div className="profile-pic-uploader-overlay">
      <div className="profile-pic-uploader-modal">
        <h2>Upload Profile Picture</h2>
        {error && <p className="error">{error}</p>}
        <div className="uploader-content">
          {preview ? (
            <img src={preview} alt="Preview" className="preview-image" />
          ) : (
            <div className="placeholder">No preview available</div>
          )}
          <input type="file" accept="image/*" onChange={handleFileChange} />
        </div>
        <div className="uploader-actions">
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
          <button className="upload-btn" onClick={handleUpload}>Upload</button>
        </div>
      </div>
    </div>
  );
};

export default ProfilePicUploader;
