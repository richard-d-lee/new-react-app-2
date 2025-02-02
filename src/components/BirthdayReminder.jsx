import React from 'react';
const BirthdayReminder = () => {
    // Example data (replace with real data later)
    const birthdays = [
      { id: 1, name: 'Jane Doe', date: 'Tomorrow' },
      { id: 2, name: 'Alice', date: 'In 2 days' },
    ];
  
    return (
      <div className="birthday-reminder">
        {birthdays.map((birthday) => (
          <div key={birthday.id} className="birthday">
            <span>🎉</span>
            <span>
              <strong>{birthday.name}</strong>'s birthday is {birthday.date}.
            </span>
          </div>
        ))}
      </div>
    );
  };
  
  export default BirthdayReminder;