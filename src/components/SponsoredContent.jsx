import React from 'react';
const SponsoredContent = () => {
    // Example data (replace with real data later)
    const sponsored = [
      { id: 1, text: 'Check out this amazing product!', image: 'https://t3.ftcdn.net/jpg/10/29/65/84/360_F_1029658445_rfwMzxeuqrvm7GTY4Yr9WaBbYKlXIRs7.jpg' },
      { id: 2, text: 'Join our webinar today!', image: 'https://t3.ftcdn.net/jpg/10/29/65/84/360_F_1029658445_rfwMzxeuqrvm7GTY4Yr9WaBbYKlXIRs7.jpg' },
    ];
  
    return (
      <div className="sponsored-content">
        {sponsored.map((ad) => (
          <div key={ad.id} className="ad">
            <p>{ad.text}</p>
          </div>
        ))}
      </div>
    );
  };
  
  export default SponsoredContent;