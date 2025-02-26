import React, { useState } from 'react';
import TermsOfServiceModal from './TermsOfServiceModal.jsx';
import '../styles/CreateAccount.css';

const CreateAccount = ({ setCreating }) => {
  const [tosModalOpen, setTosModalOpen] = useState(false);
  const [hasReadTOS, setHasReadTOS] = useState(false); // True if user accepted TOS in the modal
  const [tosChecked, setTosChecked] = useState(false); // Actual checkbox state
  const [showHelper, setShowHelper] = useState(false); // Helper text if user tries to check box prematurely

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [username, setUsername]   = useState('');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [verifyPassword, setVerifyPassword] = useState('');
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');

  // Called when user clicks "I Accept" in the TOS modal
  const handleAcceptTOS = () => {
    setHasReadTOS(true);
    setTosChecked(true);   // Automatically check the box
    setTosModalOpen(false);
    setShowHelper(false);  // Hide helper if it was showing
  };

  // Close the TOS modal without accepting
  const handleCloseTOS = () => {
    setTosModalOpen(false);
  };

  // Attempt to toggle the TOS checkbox
  const handleCheckboxChange = (e) => {
    if (!hasReadTOS) {
      // If user hasn't accepted TOS yet, show helper text and revert the checkbox
      setShowHelper(true);
      setTosChecked(false);
    } else {
      // User can freely check/uncheck after reading TOS
      setTosChecked(e.target.checked);
      setShowHelper(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Ensure TOS is checked
    if (!tosChecked) {
      setError('You must agree to the Terms of Service to create an account.');
      return;
    }

    // Validate passwords match
    if (password !== verifyPassword) {
      setError('Passwords do not match');
      setSuccess('');
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          username,
          email,
          password
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message);
        // Clear all fields on success
        setFirstName('');
        setLastName('');
        setUsername('');
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

      {/* Terms of Service Modal */}
      {tosModalOpen && (
        <TermsOfServiceModal
          onAccept={handleAcceptTOS}
          onClose={handleCloseTOS}
        />
      )}

      <form onSubmit={handleSubmit} className="create-account-form">
        <div className="form-group">
          <label htmlFor="first-name">First Name</label>
          <input
            id="first-name"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="last-name">Last Name</label>
          <input
            id="last-name"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="create-email">Email</label>
          <input
            id="create-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="create-password">Password</label>
          <input
            id="create-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="verify-password">Verify Password</label>
          <input
            id="verify-password"
            type="password"
            value={verifyPassword}
            onChange={(e) => setVerifyPassword(e.target.value)}
            required
          />
        </div>

        {/* TOS Checkbox & Link in one line */}
        <div className="tos-checkbox">
          <input
            type="checkbox"
            id="tos"
            checked={tosChecked}
            onChange={handleCheckboxChange}
          />
          <label htmlFor="tos">
            I agree to the{' '}
            <span className="tos-link" onClick={() => setTosModalOpen(true)}>
              Terms of Service
            </span>
          </label>
        </div>
        {/* Helper text if user tries to check box too soon */}
        {showHelper && (
          <div className="tos-helper">
            Please read and accept the Terms of Service by clicking the link above.
          </div>
        )}

        <button type="submit" className="submit-btn">
          Create Account
        </button>
      </form>

      <p className="toggle-login">
        Already have an account?{' '}
        <a onClick={() => setCreating(false)}>Login here</a>
      </p>
    </div>
  );
};

export default CreateAccount;
