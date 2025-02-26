import React, { useState, useRef } from 'react';
import '../styles/TermsOfServiceModal.css';

const TermsOfServiceModal = ({ onAccept, onClose }) => {
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);
  const scrollContainerRef = useRef(null);

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (container) {
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollTop + clientHeight >= scrollHeight - 5) {
        setIsScrolledToBottom(true);
      } else {
        setIsScrolledToBottom(false);
      }
    }
  };

  return (
    <div className="tos-modal-overlay">
      <div className="tos-modal">
        {/* "x" button in the top-right corner */}
        <div className="modal-close" onClick={onClose}>×</div>

        <h2>Terms of Service</h2>
        <div
          className="tos-content"
          ref={scrollContainerRef}
          onScroll={handleScroll}
        >
          <h3>Welcome to BuzApp</h3>
          <p>
            Thank you for using our platform. By accessing or using BuzApp, you agree
            to the following Terms of Service (“Terms”). These Terms apply to all users and
            govern your use of the platform and any content or functionality we provide.
          </p>

          <h3>1. Acceptance of Terms</h3>
          <p>
            By creating an account, you agree to be bound by these Terms. If you do not
            accept these Terms in their entirety, you may not use BuzApp.
          </p>

          <h3>2. Right to Remove or Delete Content</h3>
          <p>
            We reserve the right, at our sole discretion and without notice, to remove or
            delete any content posted on BuzApp for any reason, at any time. You
            acknowledge that we shall not be liable for removing or failing to remove any
            content.
          </p>

          <h3>3. Prohibited Content</h3>
          <p>
            You agree not to post content that is illegal, defamatory, harassing, hateful,
            invasive of privacy, or otherwise objectionable. Violation of these rules may
            result in the suspension or termination of your account. You also agree to
            comply with all applicable federal, state, and local laws, including those in
            Denver, Colorado, prohibiting discriminatory or unlawful behavior.
          </p>

          <h3>4. Disclaimers</h3>
          <p>
            BuzApp is provided on an "as is" and "as available" basis. We make no
            representations or warranties of any kind, express or implied, about the
            operation or availability of our service. Any references to products or services
            are provided “as is” without warranty of any kind.
          </p>

          <h3>5. Limitation of Liability</h3>
          <p>
            In no event shall we be liable for any damages arising out of or in connection
            with your use of BuzApp, including direct, indirect, incidental, special,
            consequential, or punitive damages. This limitation of liability applies to the
            fullest extent permitted by law, including the laws of Denver, Colorado.
          </p>

          <h3>6. Indemnification</h3>
          <p>
            You agree to indemnify and hold harmless BuzApp and its affiliates from
            any claims, damages, or expenses arising out of your use of the platform or your
            violation of these Terms.
          </p>

          <h3>7. Governing Law</h3>
          <p>
            These Terms shall be governed by the laws of Denver, Colorado, USA, without
            regard to conflict of law principles. You consent to the exclusive jurisdiction
            of the state and federal courts located in or near Denver, Colorado for any
            dispute arising out of or relating to these Terms or your use of BuzApp.
          </p>

          <h3>8. Termination</h3>
          <p>
            We may terminate or suspend your access to BuzApp at any time, without
            prior notice or liability, for any reason, including but not limited to your
            violation of these Terms or any applicable local, state, or federal laws.
          </p>

          <h3>9. Changes to Terms</h3>
          <p>
            We reserve the right to modify these Terms at any time. Changes will be posted,
            and your continued use of BuzApp signifies your acceptance of any updated
            Terms.
          </p>

          <h3>10. Entire Agreement</h3>
          <p>
            These Terms constitute the entire agreement between you and BuzApp
            regarding your use of the service and supersede all prior agreements or
            understandings, written or oral.
          </p>

          <h3>11. Colorado-Specific Provisions</h3>
          <h4>11(a). Privacy and Consumer Protection</h4>
          <p>
            If applicable, BuzApp will make good-faith efforts to comply with the
            Colorado Privacy Act (CPA) and other relevant state consumer protection
            statutes. However, certain thresholds (e.g., number of Colorado resident
            users) may determine specific compliance obligations. We reserve the right
            to request additional information or actions from you to facilitate compliance
            with these laws.
          </p>

          <h4>11(b). Data Breach Notification</h4>
          <p>
            In the event of a data breach that involves your personal information, we will
            provide notifications in accordance with Colorado’s data breach notification
            requirements. This may include notifying you and, if required, the Colorado
            Attorney General, within the statutory time frame.
          </p>

          <h4>11(c). Anti-Discrimination</h4>
          <p>
            Denver municipal ordinances and Colorado law prohibit discrimination on the
            basis of race, religion, gender, sexual orientation, and other protected
            characteristics in public accommodations. By using BuzApp, you agree not
            to engage in any discriminatory conduct or content. We may remove any
            content that violates these laws or these Terms, and may terminate your account
            for such violations.
          </p>

          <h4>11(d). Local Ordinances and Cannabis Content</h4>
          <p>
            If you or other users post content relating to cannabis or marijuana, you agree
            to comply with all applicable local and state regulations, including age
            restrictions and prohibitions on interstate commerce of controlled substances.
            We reserve the right to remove any content that may violate federal or state law
            or these Terms.
          </p>

          <h3>12. Additional Legal Notices</h3>
          <h4>12(a). No Waiver</h4>
          <p>
            The failure of BuzApp to enforce any right or provision in these Terms
            shall not constitute a waiver of such right or provision.
          </p>

          <h4>12(b). Severability</h4>
          <p>
            If any part of these Terms is found invalid or unenforceable, the remaining
            sections will remain in full force and effect.
          </p>

          <h4>12(c). Survival</h4>
          <p>
            All provisions of these Terms that by their nature should survive termination
            shall survive, including ownership provisions, warranty disclaimers,
            indemnity, and limitations of liability.
          </p>

          <p>
            By scrolling through and clicking “I Accept,” you confirm that you have read,
            understood, and agree to be bound by these Terms of Service in their entirety.
          </p>
        </div>

        <div className="tos-actions">
          <button
            className="btn"
            disabled={!isScrolledToBottom}
            onClick={onAccept}
          >
            I Accept
          </button>
        </div>
      </div>
    </div>
  );
};

export default TermsOfServiceModal;
