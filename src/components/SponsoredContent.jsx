import React from 'react';
const SponsoredContent = () => {
    // Example data (replace with real data later)
    const sponsored = [
      { id: 1, text: 'Check out this amazing product!', image: 'https://via.placeholder.com/150' },
      { id: 2, text: 'Join our webinar today!', image: 'https://via.placeholder.com/150' },
    ];
  
    return (
      <div className="sponsored-content">
        {sponsored.map((ad) => (
          <div key={ad.id} className="ad">
            <img src={ad.image} alt="Sponsored" />
            <p>{ad.text}</p>
          </div>
        ))}
      </div>
    );
  };
  
  export default SponsoredContent;